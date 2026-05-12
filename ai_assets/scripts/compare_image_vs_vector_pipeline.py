import argparse
import json
from pathlib import Path

from config import PROJECT_ROOT
from export_image_vector_payload import (
    DEFAULT_CROP_ID,
    DEFAULT_DEVICE_ID,
    build_payload,
    extract_feature_from_image as export_feature_from_image,
    save_payload,
)
from local_ai_pipeline_utils import (
    compute_retrieval_vote,
    load_json_file,
    resolve_assets_dir,
    run_disease_search,
    run_organ_classifier,
)
from run_vector_ai_pipeline import (
    DEFAULT_FRUIT_INDEX_PATH,
    DEFAULT_FRUIT_METADATA_PATH,
    DEFAULT_LEAF_INDEX_PATH,
    DEFAULT_LEAF_METADATA_PATH,
    DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA,
    DEFAULT_ORGAN_CLASSIFIER_LABELS,
    DEFAULT_ORGAN_CLASSIFIER_PATH,
    prepare_feature_vector,
)


DEFAULT_TOP_K_DISEASE = 5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compare the image-based local AI/FAISS pipeline with the vector-based "
            "pipeline for one explicitly provided image."
        )
    )
    parser.add_argument("--image", required=True, help="Path to one local image file.")
    parser.add_argument(
        "--work-dir",
        required=True,
        help="Output folder for the temporary payload and comparison summary.",
    )
    parser.add_argument(
        "--top-k-disease",
        type=int,
        default=DEFAULT_TOP_K_DISEASE,
        help=f"Number of disease neighbors to retrieve. Default: {DEFAULT_TOP_K_DISEASE}",
    )
    parser.add_argument(
        "--min-organ-classifier-proba",
        type=float,
        default=DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA,
        help=(
            "Minimum organ classifier probability required to trust classifier routing. "
            f"Default: {DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA:.2f}"
        ),
    )
    parser.add_argument(
        "--show-details",
        action="store_true",
        help="Print detailed image-pipeline and vector-pipeline summaries.",
    )
    parser.add_argument(
        "--fruit-index-path",
        default=DEFAULT_FRUIT_INDEX_PATH,
        help=(
            "Fruit disease FAISS index path, relative to project root unless absolute. "
            f"Default: {DEFAULT_FRUIT_INDEX_PATH}"
        ),
    )
    parser.add_argument(
        "--fruit-metadata-path",
        default=DEFAULT_FRUIT_METADATA_PATH,
        help=(
            "Fruit disease metadata CSV path, relative to project root unless absolute. "
            f"Default: {DEFAULT_FRUIT_METADATA_PATH}"
        ),
    )
    parser.add_argument(
        "--leaf-index-path",
        default=DEFAULT_LEAF_INDEX_PATH,
        help=(
            "Leaf disease FAISS index path, relative to project root unless absolute. "
            f"Default: {DEFAULT_LEAF_INDEX_PATH}"
        ),
    )
    parser.add_argument(
        "--leaf-metadata-path",
        default=DEFAULT_LEAF_METADATA_PATH,
        help=(
            "Leaf disease metadata CSV path, relative to project root unless absolute. "
            f"Default: {DEFAULT_LEAF_METADATA_PATH}"
        ),
    )
    parser.add_argument(
        "--organ-classifier-path",
        default=DEFAULT_ORGAN_CLASSIFIER_PATH,
        help=(
            "Organ classifier model path, relative to project root unless absolute. "
            f"Default: {DEFAULT_ORGAN_CLASSIFIER_PATH}"
        ),
    )
    parser.add_argument(
        "--organ-classifier-labels",
        default=DEFAULT_ORGAN_CLASSIFIER_LABELS,
        help=(
            "Organ classifier labels JSON path, relative to project root unless absolute. "
            f"Default: {DEFAULT_ORGAN_CLASSIFIER_LABELS}"
        ),
    )
    parser.add_argument(
        "--assets-dir",
        default=str(PROJECT_ROOT),
        help="Project root that contains indexes/, metadata/, and models/. Default: project root.",
    )
    return parser.parse_args()


def ensure_valid_arguments(args: argparse.Namespace) -> None:
    if args.top_k_disease <= 0:
        raise ValueError("--top-k-disease must be a positive integer")
    if not 0.0 <= args.min_organ_classifier_proba <= 1.0:
        raise ValueError("--min-organ-classifier-proba must be between 0.0 and 1.0")


def build_support_status(vote_result: dict) -> str:
    if vote_result["top1_label"] == vote_result["majority_label"]:
        return "strong_top1_majority_alignment"
    return "mixed_neighbors"


def run_classifier_pipeline(
    vector,
    assets_dir: Path,
    top_k_disease: int,
    min_organ_classifier_proba: float,
    fruit_index_path: str,
    fruit_metadata_path: str,
    leaf_index_path: str,
    leaf_metadata_path: str,
    organ_classifier_path: str,
    organ_classifier_labels: str,
) -> dict:
    classifier_result = run_organ_classifier(
        vector=vector,
        assets_dir=assets_dir,
        classifier_path=organ_classifier_path,
        labels_path=organ_classifier_labels,
        min_probability=min_organ_classifier_proba,
    )

    result = {
        "predicted_organ": classifier_result["predicted_organ"],
        "organ_router_probability": float(classifier_result["organ_router_probability"]),
        "disease_search_status": "skipped_unknown_organ",
        "final_label": "",
        "top1_label": "",
        "top1_score": None,
        "majority_label": "",
        "majority_vote": "",
        "support_status": "",
        "index_used": "",
        "metadata_used": "",
        "score_type": "",
    }

    if result["predicted_organ"] not in {"fruit", "leaf"}:
        return result

    disease_result = run_disease_search(
        vector=vector,
        assets_dir=assets_dir,
        organ=result["predicted_organ"],
        top_k=top_k_disease,
        index_path=fruit_index_path if result["predicted_organ"] == "fruit" else leaf_index_path,
        metadata_path=(
            fruit_metadata_path
            if result["predicted_organ"] == "fruit"
            else leaf_metadata_path
        ),
    )
    vote_result = compute_retrieval_vote(disease_result["neighbors"])

    result.update(
        {
            "disease_search_status": "processed",
            "final_label": vote_result["top1_label"],
            "top1_label": vote_result["top1_label"],
            "top1_score": float(vote_result["top1_score"]),
            "majority_label": vote_result["majority_label"],
            "majority_vote": vote_result["majority_vote"],
            "support_status": build_support_status(vote_result),
            "index_used": disease_result["index_path"].name,
            "metadata_used": disease_result["metadata_path"].name,
            "score_type": disease_result["score_type"],
        }
    )
    return result


def print_comparison_summary(
    image_path: Path,
    payload_path: Path,
    comparison_summary: dict,
) -> None:
    score_difference = comparison_summary["score_difference"]
    score_difference_text = (
        f"{score_difference:.6f}" if score_difference is not None else "n/a"
    )

    print("[COMPARISON]")
    print(f"image: {image_path}")
    print(f"payload: {payload_path}")
    print(f"organ_match: {str(comparison_summary['organ_match']).lower()}")
    print(f"final_label_match: {str(comparison_summary['final_label_match']).lower()}")
    print(f"top1_label_match: {str(comparison_summary['top1_label_match']).lower()}")
    print(f"score_difference: {score_difference_text}")


def print_detail_block(title: str, result: dict) -> None:
    top1_score = result["top1_score"]
    top1_score_text = f"{top1_score:.4f}" if top1_score is not None else "n/a"

    print()
    print(f"[{title}]")
    print(f"predicted_organ: {result['predicted_organ']}")
    print(f"organ_router_probability: {result['organ_router_probability']:.4f}")
    print(f"disease_search_status: {result['disease_search_status']}")
    print(f"final_label: {result['final_label']}")
    print(f"top1_label: {result['top1_label']}")
    print(f"top1_score: {top1_score_text}")
    print(f"majority_label: {result['majority_label']}")
    print(f"majority_vote: {result['majority_vote']}")
    print(f"support_status: {result['support_status']}")


def main() -> None:
    args = parse_args()
    ensure_valid_arguments(args)

    assets_dir = resolve_assets_dir(args.assets_dir)
    image_path = Path(args.image).expanduser().resolve()
    work_dir = Path(args.work_dir).expanduser().resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    image_feature_result = export_feature_from_image(image_path)
    payload_path = work_dir / "temp_vector_payload.json"
    payload = build_payload(
        image_path=image_path,
        feature_result=image_feature_result,
        device_id=DEFAULT_DEVICE_ID,
        image_id=image_path.stem,
        crop_id=DEFAULT_CROP_ID,
    )
    save_payload(payload, payload_path)

    payload_from_disk = load_json_file(payload_path)
    vector_feature_result = prepare_feature_vector(payload_from_disk)

    image_result = run_classifier_pipeline(
        vector=image_feature_result["feature_vector"],
        assets_dir=assets_dir,
        top_k_disease=args.top_k_disease,
        min_organ_classifier_proba=args.min_organ_classifier_proba,
        fruit_index_path=args.fruit_index_path,
        fruit_metadata_path=args.fruit_metadata_path,
        leaf_index_path=args.leaf_index_path,
        leaf_metadata_path=args.leaf_metadata_path,
        organ_classifier_path=args.organ_classifier_path,
        organ_classifier_labels=args.organ_classifier_labels,
    )
    vector_result = run_classifier_pipeline(
        vector=vector_feature_result["feature_vector"],
        assets_dir=assets_dir,
        top_k_disease=args.top_k_disease,
        min_organ_classifier_proba=args.min_organ_classifier_proba,
        fruit_index_path=args.fruit_index_path,
        fruit_metadata_path=args.fruit_metadata_path,
        leaf_index_path=args.leaf_index_path,
        leaf_metadata_path=args.leaf_metadata_path,
        organ_classifier_path=args.organ_classifier_path,
        organ_classifier_labels=args.organ_classifier_labels,
    )

    image_top1_score = image_result["top1_score"]
    vector_top1_score = vector_result["top1_score"]
    score_difference = None
    if image_top1_score is not None and vector_top1_score is not None:
        score_difference = abs(image_top1_score - vector_top1_score)

    comparison_summary = {
        "image": str(image_path),
        "payload": str(payload_path),
        "organ_match": image_result["predicted_organ"] == vector_result["predicted_organ"],
        "final_label_match": image_result["final_label"] == vector_result["final_label"],
        "top1_label_match": image_result["top1_label"] == vector_result["top1_label"],
        "majority_label_match": image_result["majority_label"] == vector_result["majority_label"],
        "score_difference": score_difference,
        "image_pipeline": image_result,
        "vector_pipeline": vector_result,
    }

    summary_path = work_dir / "comparison_summary.json"
    with summary_path.open("w", encoding="utf-8") as summary_file:
        json.dump(comparison_summary, summary_file, indent=2)

    print_comparison_summary(image_path, payload_path, comparison_summary)

    if args.show_details:
        print_detail_block("IMAGE PIPELINE", image_result)
        print_detail_block("VECTOR PIPELINE", vector_result)
        print()
        print(f"comparison_summary: {summary_path}")


if __name__ == "__main__":
    main()
