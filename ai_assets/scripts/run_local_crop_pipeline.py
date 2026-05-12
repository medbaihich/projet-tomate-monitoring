# Experimental only. Not used in the current single-instance baseline pipeline.
import argparse
from pathlib import Path

import cv2
import numpy as np

from config import PROJECT_ROOT
from local_ai_pipeline_utils import (
    compute_retrieval_vote,
    extract_feature_from_bgr_image,
    make_retrieval_decision,
    run_disease_search,
    run_organ_router,
    resolve_pipeline_paths,
    ensure_file_exists,
    resolve_assets_dir,
)


DEFAULT_TOP_K_ORGAN = 7
DEFAULT_TOP_K_DISEASE = 5
DEFAULT_MIN_VOTE_RATIO = 0.60
DEFAULT_MAX_CROPS = 8
MIN_BOX_SIZE = 40
MIN_AREA_RATIO = 0.02
MAX_AREA_RATIO = 0.95
BOX_MARGIN_RATIO = 0.05
NMS_IOU_THRESHOLD = 0.45


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simulate crop-before-embedding behavior on one local image."
    )
    parser.add_argument("--image", required=True, help="Path to the local image file.")
    parser.add_argument(
        "--top-k-organ",
        type=int,
        default=DEFAULT_TOP_K_ORGAN,
        help=f"Number of organ neighbors to inspect per crop. Default: {DEFAULT_TOP_K_ORGAN}",
    )
    parser.add_argument(
        "--top-k-disease",
        type=int,
        default=DEFAULT_TOP_K_DISEASE,
        help=f"Number of disease neighbors to inspect per crop. Default: {DEFAULT_TOP_K_DISEASE}",
    )
    parser.add_argument(
        "--min-vote-ratio",
        type=float,
        default=DEFAULT_MIN_VOTE_RATIO,
        help=(
            "Minimum organ vote ratio required to continue to disease retrieval. "
            f"Default: {DEFAULT_MIN_VOTE_RATIO:.2f}"
        ),
    )
    parser.add_argument(
        "--assets-dir",
        default=str(PROJECT_ROOT),
        help="Project root that contains indexes/ and metadata/. Default: project root.",
    )
    parser.add_argument(
        "--max-crops",
        type=int,
        default=DEFAULT_MAX_CROPS,
        help=f"Maximum number of crop proposals to keep after NMS. Default: {DEFAULT_MAX_CROPS}",
    )
    parser.add_argument(
        "--show-organ-neighbors",
        action="store_true",
        help="Print the top-k organ neighbors for each crop.",
    )
    parser.add_argument(
        "--show-disease-neighbors",
        action="store_true",
        help="Print the top-k disease neighbors for each crop.",
    )
    return parser.parse_args()


def load_source_image(image_path: Path) -> np.ndarray:
    ensure_file_exists(image_path, "input image")

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image with OpenCV: {image_path}")

    return image


def expand_box(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    image_width: int,
    image_height: int,
    margin_ratio: float = BOX_MARGIN_RATIO,
) -> tuple[int, int, int, int]:
    width = x2 - x1
    height = y2 - y1
    margin_x = int(width * margin_ratio)
    margin_y = int(height * margin_ratio)

    return (
        max(0, x1 - margin_x),
        max(0, y1 - margin_y),
        min(image_width, x2 + margin_x),
        min(image_height, y2 + margin_y),
    )


def compute_iou(first_box: tuple[int, int, int, int], second_box: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = first_box
    bx1, by1, bx2, by2 = second_box

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union_area = area_a + area_b - inter_area

    if union_area <= 0:
        return 0.0

    return inter_area / union_area


def non_max_suppression(
    boxes_with_scores: list[tuple[tuple[int, int, int, int], float]],
    iou_threshold: float,
    max_crops: int,
) -> list[tuple[int, int, int, int]]:
    selected: list[tuple[int, int, int, int]] = []

    for box, _score in sorted(boxes_with_scores, key=lambda item: item[1], reverse=True):
        if any(compute_iou(box, kept_box) >= iou_threshold for kept_box in selected):
            continue
        selected.append(box)
        if len(selected) >= max_crops:
            break

    return selected


def generate_candidate_boxes(image: np.ndarray, max_crops: int) -> tuple[list[tuple[int, int, int, int]], bool]:
    image_height, image_width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 60, 160)
    edges = cv2.dilate(edges, None, iterations=2)

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    saturation_mask = cv2.inRange(saturation, 40, 255)
    value_mask = cv2.inRange(value, 35, 255)
    mask = cv2.bitwise_and(saturation_mask, value_mask)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    combined = cv2.bitwise_or(mask, edges)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes_with_scores: list[tuple[tuple[int, int, int, int], float]] = []

    image_area = float(image_width * image_height)

    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if width < MIN_BOX_SIZE or height < MIN_BOX_SIZE:
            continue

        box_area_ratio = (width * height) / image_area
        if box_area_ratio < MIN_AREA_RATIO or box_area_ratio > MAX_AREA_RATIO:
            continue

        expanded_box = expand_box(
            x1=x,
            y1=y,
            x2=x + width,
            y2=y + height,
            image_width=image_width,
            image_height=image_height,
        )
        contour_score = float(cv2.contourArea(contour))
        boxes_with_scores.append((expanded_box, contour_score))

    if not boxes_with_scores:
        fallback_box = (0, 0, image_width, image_height)
        return [fallback_box], True

    selected_boxes = non_max_suppression(
        boxes_with_scores=boxes_with_scores,
        iou_threshold=NMS_IOU_THRESHOLD,
        max_crops=max_crops,
    )
    return selected_boxes, False


def print_pipeline_header(
    image_path: Path,
    image_shape: tuple[int, int, int],
    num_candidate_crops: int,
    used_fallback_box: bool,
) -> None:
    print("[LOCAL CROP-FIRST PIPELINE]")
    print(f"image: {image_path}")
    print(f"image_size: {image_shape[1]}x{image_shape[0]}")
    print("cropper: opencv_contour_region_proposals")
    print(f"candidate_crops: {num_candidate_crops}")
    print(f"fallback_full_image_crop: {used_fallback_box}")


def print_crop_header(
    crop_number: int,
    box: tuple[int, int, int, int],
    crop_shape: tuple[int, int, int],
    feature_result: dict,
) -> None:
    x1, y1, x2, y2 = box
    print()
    print(f"[CROP {crop_number}]")
    print(f"bbox: x1={x1}, y1={y1}, x2={x2}, y2={y2}")
    print(f"crop_size: {crop_shape[1]}x{crop_shape[0]}")
    print(f"feature_dim: {feature_result['feature_dim']}")
    print(f"vector_norm: {feature_result['vector_norm']:.4f}")


def print_crop_organ_summary(
    organ_result: dict,
) -> None:
    print("[ORGAN ROUTER]")
    print(f"predicted_organ: {organ_result['predicted_organ']}")
    print(f"vote: {organ_result['vote']}")
    print(f"vote_ratio: {organ_result['vote_ratio']:.3f}")
    print(f"fruit_count: {organ_result['fruit_count']}")
    print(f"leaf_count: {organ_result['leaf_count']}")
    print(f"metric: {organ_result['metric']}")


def print_crop_unknown_message(vote_ratio: float, min_vote_ratio: float) -> None:
    print("[DISEASE FAISS SEARCH]")
    print("status: skipped")
    print(
        "reason: predicted organ is unknown because the organ vote ratio "
        f"({vote_ratio:.3f}) is below the threshold ({min_vote_ratio:.3f})"
    )


def print_crop_disease_summary(
    disease_result: dict,
    vote_result: dict,
) -> None:
    print("[DISEASE FAISS SEARCH]")
    print(f"index_used: {disease_result['index_path'].name}")
    print(f"metadata_used: {disease_result['metadata_path'].name}")
    print(f"score_type: {disease_result['score_type']}")
    print(f"top1_label: {vote_result['top1_label']}")
    print(f"top1_score: {vote_result['top1_score']:.4f}")


def print_disease_neighbors(neighbors: list[dict]) -> None:
    print()
    print("Top-k disease neighbors:")

    for neighbor in neighbors:
        print(
            f"{neighbor['rank']}. {neighbor['label']} | score={neighbor['score']:.4f} | "
            f"source_row_id={neighbor['source_row_id']}"
        )


def print_label_vote_summary(vote_result: dict) -> None:
    print()
    print("[RETRIEVAL LABEL VOTE]")
    print("prediction_type: retrieval_based_nearest_neighbors")
    print(f"majority_label: {vote_result['majority_label']}")
    print(f"majority_vote: {vote_result['majority_vote']}")
    print(f"majority_vote_ratio: {vote_result['majority_vote_ratio']:.3f}")
    print(f"weighted_label: {vote_result['weighted_label']}")
    print("label_score_average:")
    for label, score_average in vote_result["label_score_average"].items():
        print(f"- {label}: {score_average:.4f}")


def print_retrieval_decision(decision_result: dict) -> None:
    print("[RETRIEVAL DECISION]")
    print(f"decision: {decision_result['decision']}")
    print(f"final_label: {decision_result['final_label']}")
    print(f"recommended_action: {decision_result['recommended_action']}")
    print("reasons:")
    for reason in decision_result["reasons"]:
        print(f"- {reason}")


def print_organ_neighbors(neighbors: list[dict]) -> None:
    print()
    print("Top-k organ neighbors:")

    for neighbor in neighbors:
        print(
            f"{neighbor['rank']}. {neighbor['organ']:<5} | label={neighbor['label']} | "
            f"score={neighbor['score']:.4f} | source_row_id={neighbor['source_row_id']}"
        )


def print_final_summary(results: list[dict]) -> None:
    total_crops = len(results)
    fruit_crops = sum(1 for result in results if result["predicted_organ"] == "fruit")
    leaf_crops = sum(1 for result in results if result["predicted_organ"] == "leaf")
    unknown_crops = sum(1 for result in results if result["predicted_organ"] == "unknown")
    disease_ran = sum(1 for result in results if result["disease_ran"])

    print()
    print("[FINAL SUMMARY]")
    print(f"processed_crops: {total_crops}")
    print(f"disease_searches_run: {disease_ran}")
    print(f"fruit_crops: {fruit_crops}")
    print(f"leaf_crops: {leaf_crops}")
    print(f"unknown_crops: {unknown_crops}")


def main() -> None:
    args = parse_args()

    image_path = Path(args.image).expanduser().resolve()
    assets_dir = resolve_assets_dir(args.assets_dir)
    resolve_pipeline_paths(assets_dir)

    source_image = load_source_image(image_path)
    candidate_boxes, used_fallback_box = generate_candidate_boxes(source_image, args.max_crops)
    print_pipeline_header(image_path, source_image.shape, len(candidate_boxes), used_fallback_box)

    results: list[dict] = []

    for crop_number, box in enumerate(candidate_boxes, start=1):
        x1, y1, x2, y2 = box
        crop = source_image[y1:y2, x1:x2]
        feature_result = extract_feature_from_bgr_image(
            image_bgr=crop,
            source_name=f"{image_path}#crop_{crop_number}",
        )

        print_crop_header(crop_number, box, crop.shape, feature_result)

        organ_result = run_organ_router(
            vector=feature_result["feature_vector"],
            assets_dir=assets_dir,
            top_k=args.top_k_organ,
            min_vote_ratio=args.min_vote_ratio,
        )
        print_crop_organ_summary(organ_result)

        if args.show_organ_neighbors:
            print_organ_neighbors(organ_result["neighbors"])

        result = {
            "predicted_organ": organ_result["predicted_organ"],
            "disease_ran": False,
        }

        if organ_result["predicted_organ"] == "unknown":
            print_crop_unknown_message(organ_result["vote_ratio"], args.min_vote_ratio)
            results.append(result)
            continue

        disease_result = run_disease_search(
            vector=feature_result["feature_vector"],
            assets_dir=assets_dir,
            organ=organ_result["predicted_organ"],
            top_k=args.top_k_disease,
        )
        vote_result = compute_retrieval_vote(disease_result["neighbors"])
        decision_result = make_retrieval_decision(
            vote_result=vote_result,
            thresholds={
                "min_top1_score": 0.65,
                "min_majority_vote_ratio": 0.60,
            },
        )
        print_crop_disease_summary(disease_result, vote_result)

        if args.show_disease_neighbors:
            print_disease_neighbors(disease_result["neighbors"])

        print_label_vote_summary(vote_result)
        print_retrieval_decision(decision_result)

        result["disease_ran"] = True
        results.append(result)

    print_final_summary(results)


if __name__ == "__main__":
    main()
