import csv
import shutil
from pathlib import Path

import cv2
import pandas as pd

from config import (
    MASTER_METADATA_CSV,
    FINAL_METADATA_CSV,
    DATASET_FINAL_DIR,
    METADATA_DIR,
)

MIN_CROP_SIZE = 20      
MARGIN_RATIO = 0.10     

def ensure_dirs():
    DATASET_FINAL_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

def yolo_to_xyxy(xc, yc, w, h, img_w, img_h, margin_ratio=MARGIN_RATIO):
    x_center = xc * img_w
    y_center = yc * img_h
    box_w = w * img_w
    box_h = h * img_h

    # إضافة هامش بسيط
    box_w *= (1 + margin_ratio)
    box_h *= (1 + margin_ratio)

    x1 = int(max(0, x_center - box_w / 2))
    y1 = int(max(0, y_center - box_h / 2))
    x2 = int(min(img_w, x_center + box_w / 2))
    y2 = int(min(img_h, y_center + box_h / 2))

    return x1, y1, x2, y2

def save_crop(img, x1, y1, x2, y2, out_path: Path):
    crop = img[y1:y2, x1:x2]

    if crop.size == 0:
        return False, "empty_crop", None

    h, w = crop.shape[:2]
    if w < MIN_CROP_SIZE or h < MIN_CROP_SIZE:
        return False, f"too_small_{w}x{h}", None

    out_path.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(out_path), crop)

    if not ok:
        return False, "imwrite_failed", None

    return True, "ok", (w, h)

def main():
    ensure_dirs()

    df = pd.read_csv(MASTER_METADATA_CSV)
    final_rows = []

    skipped_copy_errors = 0
    skipped_unreadable_images = 0
    skipped_bad_crops = 0

    for idx, row in df.iterrows():
        source = row["source"]
        label = row["label"]
        organ = row["organ"]
        image_path = Path(row["image_path"])

        out_dir = DATASET_FINAL_DIR / organ / label
        out_dir.mkdir(parents=True, exist_ok=True)

        out_name = f"{source}_{row['sample_id']}_{idx}.jpg"
        out_path = out_dir / out_name

        bbox_x1 = ""
        bbox_y1 = ""
        bbox_x2 = ""
        bbox_y2 = ""
        crop_width = ""
        crop_height = ""

        if int(row["is_crop_needed"]) == 0:
            try:
                shutil.copy2(image_path, out_path)
            except Exception as e:
                print(f"[WARN] Copy failed: {image_path} -> {out_path} | {e}")
                skipped_copy_errors += 1
                continue

        else:
            img = cv2.imread(str(image_path))
            if img is None:
                print(f"[WARN] Could not read image: {image_path}")
                skipped_unreadable_images += 1
                continue

            img_h, img_w = img.shape[:2]

            x1, y1, x2, y2 = yolo_to_xyxy(
                float(row["xc"]),
                float(row["yc"]),
                float(row["w"]),
                float(row["h"]),
                img_w,
                img_h,
            )

            ok, reason, crop_size = save_crop(img, x1, y1, x2, y2, out_path)
            if not ok:
                print(f"[WARN] Crop skipped ({reason}): {image_path}")
                skipped_bad_crops += 1
                continue

            bbox_x1, bbox_y1, bbox_x2, bbox_y2 = x1, y1, x2, y2
            crop_width, crop_height = crop_size

        final_rows.append({
            "sample_id": row["sample_id"],
            "source": source,
            "source_type": row["source_type"],
            "split": row["split"],
            "original_label": row["original_label"],
            "label": label,
            "organ": organ,
            "image_path_raw": str(image_path),
            "image_path_final": str(out_path.resolve()),
            "is_crop_needed": row["is_crop_needed"],
            "bbox_index": row.get("bbox_index", ""),
            "class_id": row.get("class_id", ""),
            "bbox_x1": bbox_x1,
            "bbox_y1": bbox_y1,
            "bbox_x2": bbox_x2,
            "bbox_y2": bbox_y2,
            "crop_width": crop_width,
            "crop_height": crop_height,
        })

    with open(FINAL_METADATA_CSV, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "sample_id",
            "source",
            "source_type",
            "split",
            "original_label",
            "label",
            "organ",
            "image_path_raw",
            "image_path_final",
            "is_crop_needed",
            "bbox_index",
            "class_id",
            "bbox_x1",
            "bbox_y1",
            "bbox_x2",
            "bbox_y2",
            "crop_width",
            "crop_height",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(final_rows)

    print("\n===== DONE =====")
    print(f"Final dataset created at: {DATASET_FINAL_DIR}")
    print(f"Final metadata saved to: {FINAL_METADATA_CSV}")
    print(f"Total final samples: {len(final_rows)}")
    print(f"Skipped copy errors: {skipped_copy_errors}")
    print(f"Skipped unreadable images: {skipped_unreadable_images}")
    print(f"Skipped bad crops: {skipped_bad_crops}")

if __name__ == "__main__":
    main()