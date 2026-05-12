import argparse
import sys
from pathlib import Path

PROJECT_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT_DIR))

from config import PROJECT_ROOT
from ai_engine.vector_inference_service import (
    DEFAULT_FRUIT_INDEX_PATH,
    DEFAULT_FRUIT_METADATA_PATH,
    DEFAULT_LEAF_INDEX_PATH,
    DEFAULT_LEAF_METADATA_PATH,
    DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA,
    DEFAULT_ORGAN_CLASSIFIER_LABELS,
    DEFAULT_ORGAN_CLASSIFIER_PATH,
    InferenceConfig,
    run_inference_from_payload,
)
from local_ai_pipeline_utils import load_json_file
from run_local_ai_pipeline import (
    print_neighbors,
    print_retrieval_summary,
    print_unknown_message,
)


DEFAULT_TOP_K_DISEASE = 5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run the current local AI/FAISS pipeline from a precomputed feature vector "
            "JSON payload instead of an image."
        )
    )
    parser.add_argument("--payload", required=True, help="Path to the JSON payload file.")
    parser.add_argument(
        "--organ-router-method",
        choices=["classifier"],
        default="classifier",
        help="Organ routing method to use. Default: classifier",
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
        "--show-disease-neighbors",
        action="store_true",
        help="Print the top-k disease neighbors after retrieval.",
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


def print_pipeline_header(payload_path: Path, payload: dict, feature_result: dict) -> None:
    crop_id = payload.get("crop_id", "")

    print("[VECTOR AI PIPELINE]")
    print(f"device_id: {payload['device_id']}")
    print(f"image_id: {payload['image_id']}")
    print(f"crop_id: {crop_id}")
    print(f"feature_dim: {feature_result['feature_dim']}")
    print(f"vector_norm: {feature_result['vector_norm']:.4f}")


def print_classifier_organ_summary(classifier_result: dict) -> None:
    print()
    print("[ORGAN ROUTER]")
    print(f"predicted_organ: {classifier_result['predicted_organ']}")
    print(f"organ_router_probability: {classifier_result['organ_router_probability']:.4f}")


def main() -> None:
    args = parse_args()
    ensure_valid_arguments(args)

    payload_path = Path(args.payload).expanduser().resolve()
    payload = load_json_file(payload_path)
    config = InferenceConfig(
        assets_dir=args.assets_dir,
        top_k_disease=args.top_k_disease,
        min_organ_classifier_proba=args.min_organ_classifier_proba,
        fruit_index_path=args.fruit_index_path,
        fruit_metadata_path=args.fruit_metadata_path,
        leaf_index_path=args.leaf_index_path,
        leaf_metadata_path=args.leaf_metadata_path,
        organ_classifier_path=args.organ_classifier_path,
        organ_classifier_labels=args.organ_classifier_labels,
    )
    inference_result = run_inference_from_payload(payload, config=config)
    feature_result = inference_result["feature_result"]

    for warning in feature_result["warnings"]:
        print(f"warning: {warning}")

    print_pipeline_header(payload_path, payload, feature_result)
    classifier_result = inference_result["classifier_result"]
    print_classifier_organ_summary(classifier_result)

    if inference_result["processing_status"] == "skipped_unknown_organ":
        print_unknown_message(inference_result["skip_reasons"])
        return

    disease_result = inference_result["disease_result"]
    vote_result = inference_result["vote_result"]
    print_retrieval_summary(disease_result, vote_result)

    if args.show_disease_neighbors:
        print_neighbors(inference_result["matches"], organ_mode=False)


if __name__ == "__main__":
    main()
