import argparse
from pathlib import Path

from config import PROJECT_ROOT
from local_ai_pipeline_utils import (
    compute_retrieval_vote,
    extract_feature_from_image,
    resolve_assets_dir,
    run_organ_classifier,
    run_disease_search,
    run_organ_router,
)


DEFAULT_TOP_K_ORGAN = 7
DEFAULT_TOP_K_DISEASE = 5
DEFAULT_MIN_VOTE_RATIO = 0.60
DEFAULT_MIN_ORGAN_TOP_SCORE = 0.60
DEFAULT_ORGAN_INDEX = "indexes/organ_faiss.index"
DEFAULT_ORGAN_METADATA = "metadata/organ_metadata.csv"
DEFAULT_ORGAN_ROUTER_METHOD = "faiss"
DEFAULT_ORGAN_CLASSIFIER_PATH = "models/organ_classifier_logreg.pkl"
DEFAULT_ORGAN_CLASSIFIER_LABELS = "models/organ_classifier_labels.json"
DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA = 0.60


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run the local AI + FAISS pipeline on one tomato image. "
            "This script assumes one tomato fruit or one tomato leaf per image."
        )
    )
    parser.add_argument("--image", required=True, help="Path to the local image file.")
    parser.add_argument(
        "--top-k-organ",
        type=int,
        default=DEFAULT_TOP_K_ORGAN,
        help=f"Number of organ neighbors to inspect. Default: {DEFAULT_TOP_K_ORGAN}",
    )
    parser.add_argument(
        "--top-k-disease",
        type=int,
        default=DEFAULT_TOP_K_DISEASE,
        help=f"Number of disease neighbors to inspect. Default: {DEFAULT_TOP_K_DISEASE}",
    )
    parser.add_argument(
        "--min-vote-ratio",
        type=float,
        default=DEFAULT_MIN_VOTE_RATIO,
        help=(
            "Minimum majority ratio required to return fruit or leaf from the organ router. "
            f"Default: {DEFAULT_MIN_VOTE_RATIO:.2f}"
        ),
    )
    parser.add_argument(
        "--min-organ-top-score",
        type=float,
        default=DEFAULT_MIN_ORGAN_TOP_SCORE,
        help=(
            "Minimum top organ similarity score required to trust the organ router. "
            f"Default: {DEFAULT_MIN_ORGAN_TOP_SCORE:.2f}"
        ),
    )
    parser.add_argument(
        "--organ-router-method",
        choices=["faiss", "classifier"],
        default=DEFAULT_ORGAN_ROUTER_METHOD,
        help=f"Organ routing method to use. Default: {DEFAULT_ORGAN_ROUTER_METHOD}",
    )
    parser.add_argument(
        "--assets-dir",
        default=str(PROJECT_ROOT),
        help="Project root that contains indexes/ and metadata/. Default: project root.",
    )
    parser.add_argument(
        "--organ-index",
        default=DEFAULT_ORGAN_INDEX,
        help=(
            "Organ router index path, relative to --assets-dir unless absolute. "
            f"Default: {DEFAULT_ORGAN_INDEX}"
        ),
    )
    parser.add_argument(
        "--organ-metadata",
        default=DEFAULT_ORGAN_METADATA,
        help=(
            "Organ router metadata path, relative to --assets-dir unless absolute. "
            f"Default: {DEFAULT_ORGAN_METADATA}"
        ),
    )
    parser.add_argument(
        "--organ-classifier-path",
        default=DEFAULT_ORGAN_CLASSIFIER_PATH,
        help=(
            "Organ classifier model path, relative to --assets-dir unless absolute. "
            f"Default: {DEFAULT_ORGAN_CLASSIFIER_PATH}"
        ),
    )
    parser.add_argument(
        "--organ-classifier-labels",
        default=DEFAULT_ORGAN_CLASSIFIER_LABELS,
        help=(
            "Organ classifier labels path, relative to --assets-dir unless absolute. "
            f"Default: {DEFAULT_ORGAN_CLASSIFIER_LABELS}"
        ),
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
        "--show-organ-neighbors",
        action="store_true",
        help="Print the top-k organ neighbors after routing.",
    )
    parser.add_argument(
        "--show-disease-neighbors",
        action="store_true",
        help="Print the top-k disease neighbors after retrieval.",
    )
    parser.add_argument(
        "--force-organ",
        choices=["fruit", "leaf"],
        help=(
            "Diagnostic mode only. Force the disease retrieval index to fruit or leaf "
            "without using the organ router for index selection."
        ),
    )
    return parser.parse_args()


def print_pipeline_header(feature_result: dict) -> None:
    print("[LOCAL AI PIPELINE]")
    print(f"image: {feature_result['image_path']}")
    print("assumption: single fruit or single leaf image")
    print(f"feature_dim: {feature_result['feature_dim']}")
    print(f"vector_norm: {feature_result['vector_norm']:.4f}")


def print_organ_summary(
    predicted_organ: str,
    vote_ratio: float,
    vote: str,
    top_organ_score: float,
) -> None:
    print()
    print("[ORGAN ROUTER]")
    print(f"predicted_organ: {predicted_organ}")
    print(f"vote: {vote}")
    print(f"vote_ratio: {vote_ratio:.3f}")
    print(f"top_organ_score: {top_organ_score:.4f}")


def print_forced_organ_summary(forced_organ: str) -> None:
    print()
    print("[ORGAN ROUTER]")
    print(f"predicted_organ: {forced_organ}")
    print(f"warning: diagnostic mode: organ forced to {forced_organ}")
    print("note: organ router decision skipped for index selection")


def print_classifier_organ_summary(classifier_result: dict) -> None:
    print()
    print("[ORGAN ROUTER]")
    print(f"predicted_organ: {classifier_result['predicted_organ']}")
    print(f"organ_router_probability: {classifier_result['organ_router_probability']:.4f}")


def print_retrieval_summary(disease_result: dict, vote_result: dict) -> None:
    print()
    print("[FAISS RETRIEVAL]")
    print(f"index_used: {disease_result['index_path'].name}")
    print(f"metadata_used: {disease_result['metadata_path'].name}")
    print(f"score_type: {disease_result['score_type']}")
    print(f"final_label: {vote_result['top1_label']}")
    print(f"top1_label: {vote_result['top1_label']}")
    print(f"top1_score: {vote_result['top1_score']:.4f}")
    print(f"majority_label: {vote_result['majority_label']}")
    print(f"majority_vote: {vote_result['majority_vote']}")
    if vote_result["top1_label"] != vote_result["majority_label"]:
        print("support_status: mixed_neighbors")
        print(
            "warning: top1_label and majority_label differ "
            "final_label still follows top1_label"
        )
    else:
        print("support_status: strong_top1_majority_alignment")


def print_neighbors(neighbors: list[dict], organ_mode: bool) -> None:
    print()
    title = "Top-k organ neighbors:" if organ_mode else "Top-k neighbors:"
    print(title)

    for neighbor in neighbors:
        parts = []

        if organ_mode:
            parts.append(f"{neighbor['rank']}. {neighbor['organ']:<5}")
        else:
            parts.append(f"{neighbor['rank']}. {neighbor['label']}")

        if organ_mode:
            parts.append(f"label={neighbor['label']}")

        parts.append(f"score={neighbor['score']:.4f}")
        parts.append(f"source_row_id={neighbor['source_row_id']}")

        if "sample_id" in neighbor:
            parts.append(f"sample_id={neighbor['sample_id']}")

        if "image_path_final" in neighbor:
            parts.append(f"image_path_final={neighbor['image_path_final']}")

        print(" | ".join(parts))


def print_unknown_message(reasons: list[str]) -> None:
    print()
    print("[DISEASE FAISS SEARCH]")
    print("status: skipped")
    if not reasons:
        reasons = ["organ router returned unknown"]
    for reason in reasons:
        print(f"reason: {reason}")


def apply_organ_thresholds(
    organ_result: dict,
    min_vote_ratio: float,
    min_organ_top_score: float,
) -> tuple[str, list[str]]:
    reasons: list[str] = []

    if organ_result["top_organ_score"] < min_organ_top_score:
        reasons.append(
            "top organ score below threshold "
            f"({organ_result['top_organ_score']:.4f} < {min_organ_top_score:.4f})"
        )

    if organ_result["vote_ratio"] < min_vote_ratio:
        reasons.append(
            "organ vote ratio below threshold "
            f"({organ_result['vote_ratio']:.3f} < {min_vote_ratio:.3f})"
        )

    predicted_organ = organ_result["predicted_organ"]
    if reasons:
        predicted_organ = "unknown"

    return predicted_organ, reasons


def main() -> None:
    args = parse_args()

    if not 0.0 <= args.min_organ_top_score <= 1.0:
        raise ValueError("--min-organ-top-score must be between 0.0 and 1.0")
    if not 0.0 <= args.min_organ_classifier_proba <= 1.0:
        raise ValueError("--min-organ-classifier-proba must be between 0.0 and 1.0")

    assets_dir = resolve_assets_dir(args.assets_dir)
    image_path = Path(args.image).expanduser().resolve()

    feature_result = extract_feature_from_image(image_path)
    print_pipeline_header(feature_result)

    if args.force_organ:
        predicted_organ = args.force_organ
        print_forced_organ_summary(predicted_organ)
    else:
        if args.organ_router_method == "faiss":
            organ_result = run_organ_router(
                vector=feature_result["feature_vector"],
                assets_dir=assets_dir,
                top_k=args.top_k_organ,
                min_vote_ratio=args.min_vote_ratio,
                organ_index_path=args.organ_index,
                organ_metadata_path=args.organ_metadata,
            )
            predicted_organ, organ_reasons = apply_organ_thresholds(
                organ_result=organ_result,
                min_vote_ratio=args.min_vote_ratio,
                min_organ_top_score=args.min_organ_top_score,
            )

            print_organ_summary(
                predicted_organ=predicted_organ,
                vote_ratio=organ_result["vote_ratio"],
                vote=organ_result["vote"],
                top_organ_score=organ_result["top_organ_score"],
            )

            if args.show_organ_neighbors:
                print_neighbors(organ_result["neighbors"], organ_mode=True)

            if predicted_organ == "unknown":
                print_unknown_message(organ_reasons)
                return
        else:
            classifier_result = run_organ_classifier(
                vector=feature_result["feature_vector"],
                assets_dir=assets_dir,
                classifier_path=args.organ_classifier_path,
                labels_path=args.organ_classifier_labels,
                min_probability=args.min_organ_classifier_proba,
            )
            predicted_organ = classifier_result["predicted_organ"]
            print_classifier_organ_summary(classifier_result)

            if predicted_organ == "unknown":
                print_unknown_message([
                    "organ classifier probability below threshold "
                    f"({classifier_result['organ_router_probability']:.4f} < "
                    f"{args.min_organ_classifier_proba:.4f})"
                ])
                return

    disease_result = run_disease_search(
        vector=feature_result["feature_vector"],
        assets_dir=assets_dir,
        organ=predicted_organ,
        top_k=args.top_k_disease,
    )
    vote_result = compute_retrieval_vote(disease_result["neighbors"])

    print_retrieval_summary(disease_result, vote_result)

    if args.show_disease_neighbors:
        print_neighbors(disease_result["neighbors"], organ_mode=False)


if __name__ == "__main__":
    main()
