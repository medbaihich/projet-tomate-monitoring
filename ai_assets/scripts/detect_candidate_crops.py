# Experimental only. Not used in the current single-instance baseline pipeline.
import argparse
import csv
from pathlib import Path

import cv2
import numpy as np


DEFAULT_MIN_AREA = 1500
DEFAULT_MIN_WIDTH = 30
DEFAULT_MIN_HEIGHT = 30
DEFAULT_PADDING = 20
MIN_ASPECT_RATIO = 0.40
MAX_ASPECT_RATIO = 2.50
MAX_AREA_RATIO = 0.90


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Detect candidate tomato fruit crops using classical OpenCV."
    )
    parser.add_argument("--image", required=True, help="Path to the source image.")
    parser.add_argument("--output-dir", required=True, help="Directory where crops will be saved.")
    parser.add_argument(
        "--min-area",
        type=int,
        default=DEFAULT_MIN_AREA,
        help=f"Minimum bounding-box area to keep. Default: {DEFAULT_MIN_AREA}",
    )
    parser.add_argument(
        "--min-width",
        type=int,
        default=DEFAULT_MIN_WIDTH,
        help=f"Minimum bounding-box width to keep. Default: {DEFAULT_MIN_WIDTH}",
    )
    parser.add_argument(
        "--min-height",
        type=int,
        default=DEFAULT_MIN_HEIGHT,
        help=f"Minimum bounding-box height to keep. Default: {DEFAULT_MIN_HEIGHT}",
    )
    parser.add_argument(
        "--padding",
        type=int,
        default=DEFAULT_PADDING,
        help=f"Padding in pixels added around accepted boxes. Default: {DEFAULT_PADDING}",
    )
    parser.add_argument(
        "--save-debug",
        action="store_true",
        help="Save debug_mask.png and debug_boxes.jpg.",
    )
    return parser.parse_args()


def ensure_file_exists(path: Path, description: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")


def load_source_image(image_path: Path) -> np.ndarray:
    ensure_file_exists(image_path, "source image")

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image with OpenCV: {image_path}")

    return image


def build_color_mask(image_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    red_lower_1 = np.array([0, 70, 40], dtype=np.uint8)
    red_upper_1 = np.array([10, 255, 255], dtype=np.uint8)
    red_lower_2 = np.array([160, 70, 40], dtype=np.uint8)
    red_upper_2 = np.array([180, 255, 255], dtype=np.uint8)
    orange_lower = np.array([10, 80, 50], dtype=np.uint8)
    orange_upper = np.array([25, 255, 255], dtype=np.uint8)

    red_mask_1 = cv2.inRange(hsv, red_lower_1, red_upper_1)
    red_mask_2 = cv2.inRange(hsv, red_lower_2, red_upper_2)
    orange_mask = cv2.inRange(hsv, orange_lower, orange_upper)

    combined_mask = cv2.bitwise_or(red_mask_1, red_mask_2)
    combined_mask = cv2.bitwise_or(combined_mask, orange_mask)

    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    return combined_mask


def add_padding_and_clip(
    box: tuple[int, int, int, int],
    image_width: int,
    image_height: int,
    padding: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    return (
        max(0, x1 - padding),
        max(0, y1 - padding),
        min(image_width, x2 + padding),
        min(image_height, y2 + padding),
    )


def is_reasonable_aspect_ratio(width: int, height: int) -> bool:
    if height <= 0:
        return False
    aspect_ratio = width / height
    return MIN_ASPECT_RATIO <= aspect_ratio <= MAX_ASPECT_RATIO


def find_candidate_boxes(
    mask: np.ndarray,
    image_width: int,
    image_height: int,
    min_area: int,
    min_width: int,
    min_height: int,
    padding: int,
) -> tuple[list[tuple[int, int, int, int]], int]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    accepted_boxes: list[tuple[int, int, int, int]] = []
    image_area = image_width * image_height

    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        area = width * height

        if area < min_area:
            continue

        if width < min_width or height < min_height:
            continue

        if area / image_area > MAX_AREA_RATIO:
            continue

        if not is_reasonable_aspect_ratio(width, height):
            continue

        padded_box = add_padding_and_clip(
            box=(x, y, x + width, y + height),
            image_width=image_width,
            image_height=image_height,
            padding=padding,
        )
        accepted_boxes.append(padded_box)

    accepted_boxes.sort(key=lambda box: (box[1], box[0]))
    return accepted_boxes, len(contours)


def determine_processing_mode(crops_found: int) -> str:
    if crops_found == 1:
        return "SINGLE_INSTANCE"

    if crops_found > 1:
        return "MULTI_INSTANCE"

    return "FALLBACK_WHOLE_IMAGE"


def save_crops(
    image_bgr: np.ndarray,
    source_image: Path,
    output_dir: Path,
    boxes: list[tuple[int, int, int, int]],
    processing_mode: str,
) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_rows: list[dict] = []

    if not boxes and processing_mode == "FALLBACK_WHOLE_IMAGE":
        image_height, image_width = image_bgr.shape[:2]
        boxes = [(0, 0, image_width, image_height)]

    for index, (x1, y1, x2, y2) in enumerate(boxes, start=1):
        crop = image_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        crop_id = f"crop_{index:03d}"
        crop_path = output_dir / f"{crop_id}.jpg"
        saved = cv2.imwrite(str(crop_path), crop)
        if not saved:
            raise RuntimeError(f"Failed to save crop image: {crop_path}")

        height, width = crop.shape[:2]
        metadata_rows.append({
            "crop_id": crop_id,
            "source_image": str(source_image),
            "crop_path": str(crop_path.resolve()),
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "width": width,
            "height": height,
            "area": width * height,
        })

    return metadata_rows


def save_metadata_csv(output_dir: Path, rows: list[dict]) -> Path:
    csv_path = output_dir / "crops_metadata.csv"
    fieldnames = [
        "crop_id",
        "source_image",
        "crop_path",
        "x1",
        "y1",
        "x2",
        "y2",
        "width",
        "height",
        "area",
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as file_handle:
        writer = csv.DictWriter(file_handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return csv_path


def save_debug_outputs(
    image_bgr: np.ndarray,
    mask: np.ndarray,
    metadata_rows: list[dict],
    output_dir: Path,
) -> None:
    mask_path = output_dir / "debug_mask.png"
    boxes_path = output_dir / "debug_boxes.jpg"

    saved_mask = cv2.imwrite(str(mask_path), mask)
    if not saved_mask:
        raise RuntimeError(f"Failed to save debug mask: {mask_path}")

    debug_image = image_bgr.copy()
    for row in metadata_rows:
        x1 = int(row["x1"])
        y1 = int(row["y1"])
        x2 = int(row["x2"])
        y2 = int(row["y2"])
        crop_id = str(row["crop_id"])

        cv2.rectangle(debug_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(
            debug_image,
            crop_id,
            (x1, max(20, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

    saved_boxes = cv2.imwrite(str(boxes_path), debug_image)
    if not saved_boxes:
        raise RuntimeError(f"Failed to save debug boxes image: {boxes_path}")


def print_summary(
    source_image: Path,
    contours_found: int,
    accepted_crops: int,
    processing_mode: str,
    output_dir: Path,
) -> None:
    print("[CANDIDATE CROPPER]")
    print(f"source_image: {source_image}")
    print(f"contours_found: {contours_found}")
    print(f"accepted_crops: {accepted_crops}")
    print(f"processing_mode: {processing_mode}")
    print(f"output_dir: {output_dir}")


def main() -> None:
    args = parse_args()

    image_path = Path(args.image).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    if args.min_area <= 0:
        raise ValueError("--min-area must be a positive integer")
    if args.min_width <= 0:
        raise ValueError("--min-width must be a positive integer")
    if args.min_height <= 0:
        raise ValueError("--min-height must be a positive integer")
    if args.padding < 0:
        raise ValueError("--padding must be zero or a positive integer")

    source_image = load_source_image(image_path)
    image_height, image_width = source_image.shape[:2]
    mask = build_color_mask(source_image)
    boxes, contours_found = find_candidate_boxes(
        mask=mask,
        image_width=image_width,
        image_height=image_height,
        min_area=args.min_area,
        min_width=args.min_width,
        min_height=args.min_height,
        padding=args.padding,
    )

    processing_mode = determine_processing_mode(len(boxes))
    metadata_rows = save_crops(
        image_bgr=source_image,
        source_image=image_path,
        output_dir=output_dir,
        boxes=boxes,
        processing_mode=processing_mode,
    )
    save_metadata_csv(output_dir, metadata_rows)

    if args.save_debug:
        save_debug_outputs(
            image_bgr=source_image,
            mask=mask,
            metadata_rows=metadata_rows,
            output_dir=output_dir,
        )

    print_summary(
        source_image=image_path,
        contours_found=contours_found,
        accepted_crops=len(metadata_rows),
        processing_mode=processing_mode,
        output_dir=output_dir,
    )


if __name__ == "__main__":
    main()
