import csv
from pathlib import Path
from typing import List, Dict

from config import (
    SOURCES,
    LABEL_MAP,
    SKIP_LABELS,
    IMAGE_EXTENSIONS,
    MASTER_METADATA_CSV,
    METADATA_DIR,
    detect_organ_from_label,
    KAGGLE_CLASS_NAMES,
)

def ensure_dirs():
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

def is_image_file(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_EXTENSIONS

def normalize_label(original_label: str) -> str:
    return LABEL_MAP.get(original_label, original_label.strip().lower().replace(" ", "_"))

def process_folder_dataset(source_name: str, root_dir: Path) -> List[Dict]:
    """
    To process datasets like Mendeley and Roboflow
    where each folder = class
    """
    rows = []
    sample_id = 0

    for class_dir in root_dir.rglob("*"):
        if not class_dir.is_dir():
            continue

        # Ignore unimportant folders
        if class_dir.name.startswith("."):
            continue

        original_label = class_dir.name.strip()

        # If this folder is not a known label and contains no images, skip it
        image_files = [p for p in class_dir.iterdir() if p.is_file() and is_image_file(p)]
        if not image_files:
            continue

        if original_label in SKIP_LABELS:
            print(f"[SKIP] {source_name}: {original_label}")
            continue

        normalized_label = normalize_label(original_label)
        organ = detect_organ_from_label(original_label, source_name)

        # Extract split if train/valid/test is found in the path
        split = "unsplit"
        lower_parts = [p.lower() for p in class_dir.parts]
        if "train" in lower_parts:
            split = "train"
        elif "valid" in lower_parts or "val" in lower_parts:
            split = "valid"
        elif "test" in lower_parts:
            split = "test"

        for img_path in image_files:
            rows.append({
                "sample_id": f"{source_name}_{sample_id}",
                "source": source_name,
                "source_type": "folder_classification",
                "split": split,
                "original_label": original_label,
                "label": normalized_label,
                "organ": organ,
                "image_path": str(img_path.resolve()),
                "label_path": "",
                "bbox_index": "",
                "class_id": "",
                "xc": "",
                "yc": "",
                "w": "",
                "h": "",
                "is_crop_needed": 0,
            })
            sample_id += 1

    return rows

def parse_yolo_label_file(label_file: Path):
    """
    Returns a list of dicts:
    [{"class_id": int, "xc": float, "yc": float, "w": float, "h": float}, ...]
    """
    objects = []

    if not label_file.exists():
        return objects

    with open(label_file, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f.readlines() if line.strip()]

    for idx, line in enumerate(lines):
        parts = line.split()
        if len(parts) != 5:
            print(f"[WARN] Invalid YOLO label format in {label_file}: {line}")
            continue

        try:
            class_id = int(parts[0])
            xc = float(parts[1])
            yc = float(parts[2])
            w = float(parts[3])
            h = float(parts[4])

            objects.append({
                "bbox_index": idx,
                "class_id": class_id,
                "xc": xc,
                "yc": yc,
                "w": w,
                "h": h,
            })
        except ValueError:
            print(f"[WARN] Could not parse line in {label_file}: {line}")
            continue

    return objects

def process_kaggle_yolo_dataset(source_name: str, root_dir: Path) -> List[Dict]:
    """
    To process the Kaggle YOLO dataset
    """
    rows = []
    sample_id = 0

    for split in ["train", "valid", "test"]:
        images_dir = root_dir / split / "images"
        labels_dir = root_dir / split / "labels"

        if not images_dir.exists():
            print(f"[INFO] Missing images dir: {images_dir}")
            continue

        image_files = [p for p in images_dir.iterdir() if p.is_file() and is_image_file(p)]

        for img_path in image_files:
            label_file = labels_dir / f"{img_path.stem}.txt"
            objects = parse_yolo_label_file(label_file)

            if not objects:
                # Images without labels can be ignored
                continue

            for obj in objects:
                class_id = obj["class_id"]

                if class_id < 0 or class_id >= len(KAGGLE_CLASS_NAMES):
                    print(f"[WARN] Invalid class_id={class_id} in {label_file}")
                    continue

                original_label = KAGGLE_CLASS_NAMES[class_id]

                if original_label in SKIP_LABELS:
                    continue

                normalized_label = normalize_label(original_label)
                organ = detect_organ_from_label(original_label, source_name)

                rows.append({
                    "sample_id": f"{source_name}_{sample_id}",
                    "source": source_name,
                    "source_type": "yolo_detection",
                    "split": split,
                    "original_label": original_label,
                    "label": normalized_label,
                    "organ": organ,
                    "image_path": str(img_path.resolve()),
                    "label_path": str(label_file.resolve()),
                    "bbox_index": obj["bbox_index"],
                    "class_id": class_id,
                    "xc": obj["xc"],
                    "yc": obj["yc"],
                    "w": obj["w"],
                    "h": obj["h"],
                    "is_crop_needed": 1,
                })
                sample_id += 1

    return rows

def save_rows_to_csv(rows: List[Dict], csv_path: Path):
    if not rows:
        print("[WARN] No rows to save.")
        return

    fieldnames = [
        "sample_id",
        "source",
        "source_type",
        "split",
        "original_label",
        "label",
        "organ",
        "image_path",
        "label_path",
        "bbox_index",
        "class_id",
        "xc",
        "yc",
        "w",
        "h",
        "is_crop_needed",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def main():
    ensure_dirs()

    all_rows = []

    # Mendeley
    mendeley_dir = SOURCES["mendeley"]
    if mendeley_dir.exists():
        print("[INFO] Processing Mendeley...")
        all_rows.extend(process_folder_dataset("mendeley", mendeley_dir))
    else:
        print(f"[WARN] Mendeley path not found: {mendeley_dir}")

    # Roboflow
    roboflow_dir = SOURCES["roboflow"]
    if roboflow_dir.exists():
        print("[INFO] Processing Roboflow...")
        all_rows.extend(process_folder_dataset("roboflow", roboflow_dir))
    else:
        print(f"[WARN] Roboflow path not found: {roboflow_dir}")

    # Kaggle
    kaggle_dir = SOURCES["kaggle"]
    if kaggle_dir.exists():
        print("[INFO] Processing Kaggle YOLO...")
        all_rows.extend(process_kaggle_yolo_dataset("kaggle", kaggle_dir))
    else:
        print(f"[WARN] Kaggle path not found: {kaggle_dir}")

    save_rows_to_csv(all_rows, MASTER_METADATA_CSV)
    print(f"[DONE] Saved master metadata to: {MASTER_METADATA_CSV}")
    print(f"[DONE] Total rows: {len(all_rows)}")

if __name__ == "__main__":
    main()