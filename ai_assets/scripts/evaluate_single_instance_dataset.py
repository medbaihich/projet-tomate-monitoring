import argparse
import csv
from collections import defaultdict
from pathlib import Path

import pandas as pd

from config import IMAGE_EXTENSIONS, PROJECT_ROOT
from local_ai_pipeline_utils import (
    compute_retrieval_vote,
    extract_feature_from_image,
    load_mobilenet_model,
    resolve_assets_dir,
    resolve_path_from_assets,
    run_disease_search,
    run_organ_classifier,
    run_organ_router,
)
from run_local_ai_pipeline import (
    DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA,
    DEFAULT_MIN_ORGAN_TOP_SCORE,
    DEFAULT_MIN_VOTE_RATIO,
    DEFAULT_ORGAN_CLASSIFIER_LABELS,
    DEFAULT_ORGAN_CLASSIFIER_PATH,
    DEFAULT_ORGAN_INDEX,
    DEFAULT_ORGAN_METADATA,
    DEFAULT_TOP_K_ORGAN,
    apply_organ_thresholds,
)


DEFAULT_FRUIT_INDEX_PATH = "indexes/fruit_faiss.index"
DEFAULT_FRUIT_METADATA_PATH = "metadata/fruit_metadata.csv"
DEFAULT_LEAF_INDEX_PATH = "indexes/leaf_faiss.index"
DEFAULT_LEAF_METADATA_PATH = "metadata/leaf_metadata.csv"
DEFAULT_FRUIT_EVAL_METADATA_PATH = "eval_assets/metadata/fruit_eval_metadata.csv"
DEFAULT_LEAF_EVAL_METADATA_PATH = "eval_assets/metadata/leaf_eval_metadata.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate the current single-instance local AI/FAISS baseline on a labeled "
            "test folder. This script assumes one tomato fruit or one tomato leaf per image."
        )
    )
    parser.add_argument(
        "--test-dir",
        required=True,
        help="Path to the labeled test_images folder.",
    )
    parser.add_argument(
        "--organ-router-method",
        choices=["faiss", "classifier"],
        default="classifier",
        help="Organ routing method to evaluate. Default: classifier",
    )
    parser.add_argument(
        "--top-k-disease",
        type=int,
        default=5,
        help="Number of disease neighbors to retrieve. Default: 5",
    )
    parser.add_argument(
        "--output-csv",
        default="evaluation_results.csv",
        help="Path to save per-image evaluation results. Default: evaluation_results.csv",
    )
    parser.add_argument(
        "--max-per-class",
        type=int,
        help="Optional limit on the number of images evaluated per class folder.",
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
        "--fruit-eval-metadata-path",
        default=DEFAULT_FRUIT_EVAL_METADATA_PATH,
        help=(
            "Fruit eval metadata CSV path, relative to project root unless absolute. "
            f"Default: {DEFAULT_FRUIT_EVAL_METADATA_PATH}"
        ),
    )
    parser.add_argument(
        "--leaf-eval-metadata-path",
        default=DEFAULT_LEAF_EVAL_METADATA_PATH,
        help=(
            "Leaf eval metadata CSV path, relative to project root unless absolute. "
            f"Default: {DEFAULT_LEAF_EVAL_METADATA_PATH}"
        ),
    )
    parser.add_argument(
        "--only-split",
        help=(
            "Optional metadata split filter such as train, valid, or test. "
            "Only images that can be matched to metadata rows with this split will be evaluated."
        ),
    )
    parser.add_argument(
        "--eval-split-only",
        choices=["train", "test", "all"],
        default="all",
        help=(
            "Optional eval metadata filter. Use train or test to evaluate only rows with "
            "that eval_split, or all to keep the current behavior. Default: all"
        ),
    )
    return parser.parse_args()


def ensure_valid_arguments(args: argparse.Namespace) -> None:
    if args.top_k_disease <= 0:
        raise ValueError("--top-k-disease must be a positive integer")

    if args.max_per_class is not None and args.max_per_class <= 0:
        raise ValueError("--max-per-class must be a positive integer when provided")

    if args.only_split is not None:
        requested_split = args.only_split.strip().lower()
        if not requested_split:
            raise ValueError("--only-split must not be empty when provided")
        args.only_split = requested_split


def discover_test_samples(
    test_dir: Path,
) -> list[dict]:
    if not test_dir.exists():
        raise FileNotFoundError(f"Test directory does not exist: {test_dir}")

    if not test_dir.is_dir():
        raise NotADirectoryError(f"--test-dir must point to a directory: {test_dir}")

    samples: list[dict] = []

    for expected_organ in ("fruit", "leaf"):
        organ_dir = test_dir / expected_organ
        if not organ_dir.exists():
            continue

        label_dirs = sorted(path for path in organ_dir.iterdir() if path.is_dir())
        for label_dir in label_dirs:
            image_paths = sorted(
                path
                for path in label_dir.rglob("*")
                if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
            )

            for image_path in image_paths:
                samples.append(
                    {
                        "image_path": image_path.resolve(),
                        "expected_organ": expected_organ,
                        "expected_label": label_dir.name,
                    }
                )

    if not samples:
        raise ValueError(
            "No test images found. Expected a structure like test_images/fruit/<label>/... "
            "and test_images/leaf/<label>/..."
        )

    return samples


def limit_samples_per_class(samples: list[dict], max_per_class: int | None) -> list[dict]:
    if max_per_class is None:
        return samples

    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for sample in samples:
        key = (sample["expected_organ"], sample["expected_label"])
        grouped[key].append(sample)

    limited_samples: list[dict] = []
    for key in sorted(grouped):
        class_samples = sorted(grouped[key], key=lambda sample: str(sample["image_path"]))
        limited_samples.extend(class_samples[:max_per_class])

    return limited_samples


def make_blank_result(sample: dict, organ_router_method: str, status: str) -> dict:
    return {
        "image_path": str(sample["image_path"]),
        "expected_organ": sample["expected_organ"],
        "expected_label": sample["expected_label"],
        "predicted_organ": "",
        "organ_router_method": organ_router_method,
        "organ_router_probability": "",
        "organ_top_score": "",
        "disease_search_status": status,
        "final_label": "",
        "top1_label": "",
        "top1_score": "",
        "majority_label": "",
        "majority_vote": "",
        "support_status": "",
        "organ_correct": False,
        "label_correct": False,
    }


def build_support_status(vote_result: dict) -> str:
    if vote_result["top1_label"] == vote_result["majority_label"]:
        return "strong_top1_majority_alignment"
    return "mixed_neighbors"


def load_split_metadata_lookup(metadata_path: Path, organ_name: str) -> dict:
    metadata = pd.read_csv(metadata_path)

    required_columns = {"label", "image_path_final", "split"}
    missing_columns = sorted(required_columns - set(metadata.columns))
    if missing_columns:
        raise ValueError(
            f"{organ_name} metadata is missing required columns for split filtering: "
            f"{missing_columns}"
        )

    exact_path_lookup: dict[str, str] = {}
    label_filename_lookup: dict[tuple[str, str], str | None] = {}

    for _, row in metadata.iterrows():
        row_label = str(row["label"]).strip()
        image_path_text = str(row["image_path_final"]).strip()
        split_value = str(row["split"]).strip().lower()

        if not image_path_text:
            continue

        try:
            normalized_path = str(Path(image_path_text).expanduser().resolve())
        except OSError:
            normalized_path = image_path_text

        exact_path_lookup[normalized_path] = split_value

        file_name = Path(image_path_text).name
        fallback_key = (row_label, file_name)
        if fallback_key in label_filename_lookup:
            existing_value = label_filename_lookup[fallback_key]
            if existing_value != split_value:
                label_filename_lookup[fallback_key] = None
        else:
            label_filename_lookup[fallback_key] = split_value

    return {
        "exact_path_lookup": exact_path_lookup,
        "label_filename_lookup": label_filename_lookup,
    }


def load_eval_split_lookup(metadata_path: Path, organ_name: str) -> dict[str, str | None]:
    metadata = pd.read_csv(metadata_path)

    required_columns = {"image_path_final", "eval_split"}
    missing_columns = sorted(required_columns - set(metadata.columns))
    if missing_columns:
        raise ValueError(
            f"{organ_name} eval metadata is missing required columns for eval split filtering: "
            f"{missing_columns}"
        )

    exact_path_lookup: dict[str, str | None] = {}
    for _, row in metadata.iterrows():
        image_path_text = str(row["image_path_final"]).strip()
        eval_split_value = str(row["eval_split"]).strip().lower()

        if not image_path_text:
            continue

        try:
            normalized_path = str(Path(image_path_text).expanduser().resolve())
        except OSError:
            normalized_path = image_path_text

        if normalized_path in exact_path_lookup:
            existing_value = exact_path_lookup[normalized_path]
            if existing_value != eval_split_value:
                exact_path_lookup[normalized_path] = None
        else:
            exact_path_lookup[normalized_path] = eval_split_value

    return exact_path_lookup


def match_sample_split(sample: dict, split_lookup: dict) -> str | None:
    normalized_sample_path = str(Path(sample["image_path"]).expanduser().resolve())
    exact_match = split_lookup["exact_path_lookup"].get(normalized_sample_path)
    if exact_match is not None:
        return exact_match

    fallback_key = (sample["expected_label"], Path(sample["image_path"]).name)
    fallback_match = split_lookup["label_filename_lookup"].get(fallback_key)
    if fallback_match is not None:
        return fallback_match

    return None


def match_sample_eval_split(sample: dict, eval_split_lookup: dict[str, str | None]) -> str | None:
    normalized_sample_path = str(Path(sample["image_path"]).expanduser().resolve())
    matched_eval_split = eval_split_lookup.get(normalized_sample_path)
    if matched_eval_split is None:
        return None
    return matched_eval_split


def filter_samples_by_split(
    samples: list[dict],
    only_split: str,
    fruit_metadata_path: Path,
    leaf_metadata_path: Path,
) -> tuple[list[dict], dict]:
    fruit_split_lookup = load_split_metadata_lookup(fruit_metadata_path, "fruit")
    leaf_split_lookup = load_split_metadata_lookup(leaf_metadata_path, "leaf")

    filtered_samples: list[dict] = []
    matched_count = 0
    unmatched_count = 0
    skipped_wrong_split_count = 0

    for sample in samples:
        split_lookup = (
            fruit_split_lookup
            if sample["expected_organ"] == "fruit"
            else leaf_split_lookup
        )
        matched_split = match_sample_split(sample, split_lookup)

        if matched_split is None:
            unmatched_count += 1
            continue

        matched_count += 1
        if matched_split == only_split:
            filtered_samples.append(sample)
        else:
            skipped_wrong_split_count += 1

    return filtered_samples, {
        "requested_split": only_split,
        "matched_count": matched_count,
        "unmatched_count": unmatched_count,
        "skipped_wrong_split_count": skipped_wrong_split_count,
    }


def filter_samples_by_eval_split(
    samples: list[dict],
    eval_split_only: str,
    fruit_eval_metadata_path: Path,
    leaf_eval_metadata_path: Path,
) -> tuple[list[dict], dict]:
    fruit_eval_lookup = load_eval_split_lookup(fruit_eval_metadata_path, "fruit")
    leaf_eval_lookup = load_eval_split_lookup(leaf_eval_metadata_path, "leaf")

    filtered_samples: list[dict] = []
    matched_count = 0
    unmatched_count = 0
    skipped_wrong_eval_split_count = 0

    for sample in samples:
        eval_lookup = (
            fruit_eval_lookup
            if sample["expected_organ"] == "fruit"
            else leaf_eval_lookup
        )
        matched_eval_split = match_sample_eval_split(sample, eval_lookup)

        if matched_eval_split is None:
            unmatched_count += 1
            continue

        matched_count += 1
        if matched_eval_split == eval_split_only:
            filtered_samples.append(sample)
        else:
            skipped_wrong_eval_split_count += 1

    return filtered_samples, {
        "requested_eval_split": eval_split_only,
        "matched_count": matched_count,
        "unmatched_count": unmatched_count,
        "skipped_wrong_eval_split_count": skipped_wrong_eval_split_count,
    }


def evaluate_sample(
    sample: dict,
    model,
    assets_dir: Path,
    organ_router_method: str,
    top_k_disease: int,
    fruit_index_path: str,
    fruit_metadata_path: str,
    leaf_index_path: str,
    leaf_metadata_path: str,
    organ_classifier_path: str,
    organ_classifier_labels: str,
) -> dict:
    feature_result = extract_feature_from_image(sample["image_path"], model=model)
    feature_vector = feature_result["feature_vector"]

    result = make_blank_result(
        sample=sample,
        organ_router_method=organ_router_method,
        status="skipped_unknown_organ",
    )

    predicted_organ = "unknown"

    if organ_router_method == "faiss":
        organ_result = run_organ_router(
            vector=feature_vector,
            assets_dir=assets_dir,
            top_k=DEFAULT_TOP_K_ORGAN,
            min_vote_ratio=DEFAULT_MIN_VOTE_RATIO,
            organ_index_path=DEFAULT_ORGAN_INDEX,
            organ_metadata_path=DEFAULT_ORGAN_METADATA,
        )
        predicted_organ, _organ_reasons = apply_organ_thresholds(
            organ_result=organ_result,
            min_vote_ratio=DEFAULT_MIN_VOTE_RATIO,
            min_organ_top_score=DEFAULT_MIN_ORGAN_TOP_SCORE,
        )
        result["organ_top_score"] = round(float(organ_result["top_organ_score"]), 6)
    else:
        classifier_result = run_organ_classifier(
            vector=feature_vector,
            assets_dir=assets_dir,
            classifier_path=organ_classifier_path,
            labels_path=organ_classifier_labels,
            min_probability=DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA,
        )
        predicted_organ = classifier_result["predicted_organ"]
        result["organ_router_probability"] = round(
            float(classifier_result["organ_router_probability"]),
            6,
        )

    result["predicted_organ"] = predicted_organ
    result["organ_correct"] = predicted_organ == sample["expected_organ"]

    if predicted_organ not in {"fruit", "leaf"}:
        return result

    disease_result = run_disease_search(
        vector=feature_vector,
        assets_dir=assets_dir,
        organ=predicted_organ,
        top_k=top_k_disease,
        index_path=fruit_index_path if predicted_organ == "fruit" else leaf_index_path,
        metadata_path=(
            fruit_metadata_path if predicted_organ == "fruit" else leaf_metadata_path
        ),
    )
    vote_result = compute_retrieval_vote(disease_result["neighbors"])

    result["disease_search_status"] = "processed"
    result["final_label"] = vote_result["top1_label"]
    result["top1_label"] = vote_result["top1_label"]
    result["top1_score"] = round(float(vote_result["top1_score"]), 6)
    result["majority_label"] = vote_result["majority_label"]
    result["majority_vote"] = vote_result["majority_vote"]
    result["support_status"] = build_support_status(vote_result)
    result["label_correct"] = vote_result["top1_label"] == sample["expected_label"]
    return result


def write_results_csv(rows: list[dict], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "image_path",
        "expected_organ",
        "expected_label",
        "predicted_organ",
        "organ_router_method",
        "organ_router_probability",
        "organ_top_score",
        "disease_search_status",
        "final_label",
        "top1_label",
        "top1_score",
        "majority_label",
        "majority_vote",
        "support_status",
        "organ_correct",
        "label_correct",
    ]

    with output_csv.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def summarize_results(rows: list[dict]) -> dict:
    total_images = len(rows)
    processed_rows = [row for row in rows if row["disease_search_status"] == "processed"]
    processed_images = len(processed_rows)
    organ_correct_count = sum(1 for row in rows if row["organ_correct"])
    unknown_organ_count = sum(1 for row in rows if row["predicted_organ"] == "unknown")
    disease_search_skipped_count = sum(
        1 for row in rows if row["disease_search_status"] != "processed"
    )
    label_correct_count = sum(1 for row in processed_rows if row["label_correct"])
    top1_majority_agreement_count = sum(
        1
        for row in processed_rows
        if row["top1_label"] and row["top1_label"] == row["majority_label"]
    )

    organ_accuracy = organ_correct_count / total_images if total_images else 0.0
    label_accuracy_on_processed = (
        label_correct_count / processed_images if processed_images else 0.0
    )

    return {
        "total_images": total_images,
        "processed_images": processed_images,
        "organ_accuracy": organ_accuracy,
        "unknown_organ_count": unknown_organ_count,
        "disease_search_skipped_count": disease_search_skipped_count,
        "label_accuracy_on_processed": label_accuracy_on_processed,
        "top1_majority_agreement_count": top1_majority_agreement_count,
    }


def build_per_class_summary(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        key = (row["expected_organ"], row["expected_label"])
        grouped[key].append(row)

    summaries: list[dict] = []
    for (expected_organ, expected_label), group_rows in sorted(grouped.items()):
        numeric_top1_scores = [
            float(row["top1_score"])
            for row in group_rows
            if row["disease_search_status"] == "processed" and row["top1_score"] != ""
        ]
        average_top1_score = (
            sum(numeric_top1_scores) / len(numeric_top1_scores)
            if numeric_top1_scores
            else None
        )

        summaries.append(
            {
                "expected_organ": expected_organ,
                "expected_label": expected_label,
                "total": len(group_rows),
                "organ_correct": sum(1 for row in group_rows if row["organ_correct"]),
                "unknown_organ": sum(
                    1 for row in group_rows if row["predicted_organ"] == "unknown"
                ),
                "label_correct": sum(1 for row in group_rows if row["label_correct"]),
                "average_top1_score": average_top1_score,
            }
        )

    return summaries


def print_summary(
    test_dir: Path,
    output_csv: Path,
    organ_router_method: str,
    summary: dict,
    per_class_summary: list[dict],
    only_split: str | None,
    split_filter_stats: dict | None,
    eval_split_only: str,
    eval_split_filter_stats: dict | None,
) -> None:
    print("[DATASET EVALUATION]")
    print(f"test_dir: {test_dir}")
    print("assumption: single fruit or single leaf image")
    print(f"organ_router_method: {organ_router_method}")
    if only_split is not None and split_filter_stats is not None:
        print(f"only_split: {only_split}")
        print(f"matched_for_split_filter: {split_filter_stats['matched_count']}")
        print(f"unmatched_for_split_filter: {split_filter_stats['unmatched_count']}")
        print(
            "excluded_by_split_filter: "
            f"{split_filter_stats['skipped_wrong_split_count']}"
        )
    if eval_split_only != "all" and eval_split_filter_stats is not None:
        print(f"eval_split_only: {eval_split_only}")
        print(f"matched_for_eval_split_filter: {eval_split_filter_stats['matched_count']}")
        print(
            f"unmatched_for_eval_split_filter: "
            f"{eval_split_filter_stats['unmatched_count']}"
        )
        print(
            "excluded_by_eval_split_filter: "
            f"{eval_split_filter_stats['skipped_wrong_eval_split_count']}"
        )
        if eval_split_filter_stats["unmatched_count"] > 0:
            print(
                f"warning: skipped {eval_split_filter_stats['unmatched_count']} files "
                "that could not be matched in eval metadata"
            )
    print(f"total_images: {summary['total_images']}")
    print(f"processed_images: {summary['processed_images']}")
    print(f"organ_accuracy: {summary['organ_accuracy']:.4f}")
    print(f"unknown_organ_count: {summary['unknown_organ_count']}")
    print(f"disease_search_skipped_count: {summary['disease_search_skipped_count']}")
    print(
        "label_accuracy_on_processed: "
        f"{summary['label_accuracy_on_processed']:.4f}"
    )
    print(
        "top1_majority_agreement_count: "
        f"{summary['top1_majority_agreement_count']}"
    )
    print(f"output_csv: {output_csv}")

    print()
    print("[PER-CLASS SUMMARY]")
    for class_summary in per_class_summary:
        average_top1_score = class_summary["average_top1_score"]
        average_top1_score_text = (
            f"{average_top1_score:.4f}" if average_top1_score is not None else "n/a"
        )
        print(
            f"{class_summary['expected_organ']} | {class_summary['expected_label']} | "
            f"total={class_summary['total']} | "
            f"organ_correct={class_summary['organ_correct']} | "
            f"unknown_organ={class_summary['unknown_organ']} | "
            f"label_correct={class_summary['label_correct']} | "
            f"average_top1_score={average_top1_score_text}"
        )


def main() -> None:
    args = parse_args()
    ensure_valid_arguments(args)

    assets_dir = resolve_assets_dir(PROJECT_ROOT)
    test_dir = Path(args.test_dir).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()

    samples = discover_test_samples(test_dir)

    split_filter_stats = None
    if args.only_split is not None:
        resolved_fruit_metadata_path = resolve_path_from_assets(
            assets_dir,
            args.fruit_metadata_path,
        )
        resolved_leaf_metadata_path = resolve_path_from_assets(
            assets_dir,
            args.leaf_metadata_path,
        )
        samples, split_filter_stats = filter_samples_by_split(
            samples=samples,
            only_split=args.only_split,
            fruit_metadata_path=resolved_fruit_metadata_path,
            leaf_metadata_path=resolved_leaf_metadata_path,
        )
        if not samples:
            raise ValueError(
                f"No samples matched --only-split {args.only_split!r} after metadata filtering"
            )

    eval_split_filter_stats = None
    if args.eval_split_only != "all":
        resolved_fruit_eval_metadata_path = resolve_path_from_assets(
            assets_dir,
            args.fruit_eval_metadata_path,
        )
        resolved_leaf_eval_metadata_path = resolve_path_from_assets(
            assets_dir,
            args.leaf_eval_metadata_path,
        )
        samples, eval_split_filter_stats = filter_samples_by_eval_split(
            samples=samples,
            eval_split_only=args.eval_split_only,
            fruit_eval_metadata_path=resolved_fruit_eval_metadata_path,
            leaf_eval_metadata_path=resolved_leaf_eval_metadata_path,
        )
        if not samples:
            raise ValueError(
                f"No samples matched --eval-split-only {args.eval_split_only!r} after eval metadata filtering"
            )

    samples = limit_samples_per_class(samples, args.max_per_class)

    model = load_mobilenet_model()

    rows: list[dict] = []
    for sample in samples:
        try:
            row = evaluate_sample(
                sample=sample,
                model=model,
                assets_dir=assets_dir,
                organ_router_method=args.organ_router_method,
                top_k_disease=args.top_k_disease,
                fruit_index_path=args.fruit_index_path,
                fruit_metadata_path=args.fruit_metadata_path,
                leaf_index_path=args.leaf_index_path,
                leaf_metadata_path=args.leaf_metadata_path,
                organ_classifier_path=args.organ_classifier_path,
                organ_classifier_labels=args.organ_classifier_labels,
            )
        except Exception as exc:
            print(f"warning: failed to process {sample['image_path']}: {exc}")
            row = make_blank_result(
                sample=sample,
                organ_router_method=args.organ_router_method,
                status="error",
            )
            row["predicted_organ"] = "error"

        rows.append(row)

    write_results_csv(rows, output_csv)
    summary = summarize_results(rows)
    per_class_summary = build_per_class_summary(rows)
    print_summary(
        test_dir=test_dir,
        output_csv=output_csv,
        organ_router_method=args.organ_router_method,
        summary=summary,
        per_class_summary=per_class_summary,
        only_split=args.only_split,
        split_filter_stats=split_filter_stats,
        eval_split_only=args.eval_split_only,
        eval_split_filter_stats=eval_split_filter_stats,
    )


if __name__ == "__main__":
    main()
