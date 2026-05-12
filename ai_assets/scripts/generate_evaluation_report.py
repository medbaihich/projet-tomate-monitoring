import argparse
from pathlib import Path

import pandas as pd


DEFAULT_RESULTS_CSV = "evaluation_results_test_only.csv"
DEFAULT_CONFUSION_CSV = "evaluation_confusion_pairs.csv"
DEFAULT_ERROR_SUMMARY_CSV = "evaluation_error_summary.csv"
DEFAULT_OUTPUT_MD = "AI_FAISS_EVALUATION_REPORT.md"

RESULTS_REQUIRED_COLUMNS = {
    "expected_organ",
    "expected_label",
    "predicted_organ",
    "disease_search_status",
    "final_label",
    "top1_score",
    "majority_label",
    "organ_correct",
    "label_correct",
}
CONFUSION_REQUIRED_COLUMNS = {
    "expected_organ",
    "expected_label",
    "final_label",
    "count",
    "is_error",
}
ERROR_SUMMARY_REQUIRED_COLUMNS = {
    "summary_type",
    "expected_organ",
    "expected_label",
    "total",
    "correct",
    "wrong",
    "accuracy",
    "average_top1_score",
}

SIMILARITY_HINTS = {
    frozenset({"catfaced", "fruit_cracking"}): (
        "These categories may remain difficult because both can involve subtle fruit-shape "
        "or surface-defect cues rather than large, clean lesion patterns."
    ),
    frozenset({"blossom_end_rot", "late_blight"}): (
        "This pair may overlap visually because both can present dark damaged regions that "
        "look lesion-like in a retrieval setting."
    ),
    frozenset({"blossom_end_rot", "anthracnose"}): (
        "This confusion may reflect visually similar dark necrotic regions on fruit surfaces."
    ),
    frozenset({"leaf_curl", "bushy_stunt"}): (
        "This pair may be hard because both classes affect leaf shape and overall plant morphology."
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a markdown evaluation report from saved CSV outputs."
    )
    parser.add_argument(
        "--results-csv",
        default=DEFAULT_RESULTS_CSV,
        help=f"Path to the evaluation results CSV. Default: {DEFAULT_RESULTS_CSV}",
    )
    parser.add_argument(
        "--confusion-csv",
        default=DEFAULT_CONFUSION_CSV,
        help=f"Path to the confusion-pairs CSV. Default: {DEFAULT_CONFUSION_CSV}",
    )
    parser.add_argument(
        "--error-summary-csv",
        default=DEFAULT_ERROR_SUMMARY_CSV,
        help=f"Path to the evaluation summary CSV. Default: {DEFAULT_ERROR_SUMMARY_CSV}",
    )
    parser.add_argument(
        "--output-md",
        default=DEFAULT_OUTPUT_MD,
        help=f"Markdown report output path. Default: {DEFAULT_OUTPUT_MD}",
    )
    return parser.parse_args()


def ensure_columns(dataframe: pd.DataFrame, required_columns: set[str], description: str) -> None:
    missing_columns = sorted(required_columns - set(dataframe.columns))
    if missing_columns:
        raise ValueError(f"{description} is missing required columns: {missing_columns}")


def load_csv(path_value: str, required_columns: set[str], description: str) -> tuple[Path, pd.DataFrame]:
    path = Path(path_value).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")

    dataframe = pd.read_csv(path)
    ensure_columns(dataframe, required_columns, description)
    return path, dataframe


def normalize_results(results_df: pd.DataFrame) -> pd.DataFrame:
    normalized = results_df.copy()
    normalized["label_correct"] = normalized["label_correct"].astype(str).str.lower().map(
        {"true": True, "false": False}
    )
    normalized["organ_correct"] = normalized["organ_correct"].astype(str).str.lower().map(
        {"true": True, "false": False}
    )
    if normalized["label_correct"].isna().any():
        raise ValueError("results CSV contains non-boolean label_correct values")
    if normalized["organ_correct"].isna().any():
        raise ValueError("results CSV contains non-boolean organ_correct values")

    normalized["top1_score_numeric"] = pd.to_numeric(
        normalized["top1_score"],
        errors="coerce",
    )
    normalized["final_label"] = normalized["final_label"].fillna("").astype(str)
    normalized["majority_label"] = normalized["majority_label"].fillna("").astype(str)
    return normalized


def normalize_error_summary(summary_df: pd.DataFrame) -> pd.DataFrame:
    normalized = summary_df.copy()
    normalized["summary_type"] = normalized["summary_type"].fillna("").astype(str)
    normalized["expected_organ"] = normalized["expected_organ"].fillna("").astype(str)
    normalized["expected_label"] = normalized["expected_label"].fillna("").astype(str)
    normalized["total"] = pd.to_numeric(normalized["total"], errors="raise").astype(int)
    normalized["correct"] = pd.to_numeric(normalized["correct"], errors="raise").astype(int)
    normalized["wrong"] = pd.to_numeric(normalized["wrong"], errors="raise").astype(int)
    normalized["accuracy"] = pd.to_numeric(normalized["accuracy"], errors="coerce")
    normalized["average_top1_score"] = pd.to_numeric(
        normalized["average_top1_score"],
        errors="coerce",
    )
    return normalized


def normalize_confusion(confusion_df: pd.DataFrame) -> pd.DataFrame:
    normalized = confusion_df.copy()
    normalized["expected_organ"] = normalized["expected_organ"].fillna("").astype(str)
    normalized["expected_label"] = normalized["expected_label"].fillna("").astype(str)
    normalized["final_label"] = normalized["final_label"].fillna("").astype(str)
    normalized["count"] = pd.to_numeric(normalized["count"], errors="raise").astype(int)
    normalized["is_error"] = normalized["is_error"].astype(str).str.lower().map(
        {"true": True, "false": False}
    )
    if normalized["is_error"].isna().any():
        raise ValueError("confusion CSV contains non-boolean is_error values")
    return normalized


def safe_rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def format_pct(value: float) -> str:
    return f"{value * 100:.2f}%"


def format_score(value) -> str:
    if pd.isna(value):
        return "n/a"
    return f"{float(value):.4f}"


def build_executive_summary(results_df: pd.DataFrame, summary_df: pd.DataFrame) -> dict:
    total_images = int(len(results_df))
    processed_images = int((results_df["disease_search_status"] == "processed").sum())
    organ_accuracy = safe_rate(int(results_df["organ_correct"].sum()), total_images)
    label_accuracy = safe_rate(int(results_df["label_correct"].sum()), processed_images)
    top1_majority_agreement_rate = safe_rate(
        int((results_df["final_label"] == results_df["majority_label"]).sum()),
        processed_images,
    )

    organ_rows = summary_df.loc[summary_df["summary_type"] == "organ"].copy()
    fruit_row = organ_rows.loc[organ_rows["expected_organ"] == "fruit"]
    leaf_row = organ_rows.loc[organ_rows["expected_organ"] == "leaf"]
    fruit_accuracy = float(fruit_row.iloc[0]["accuracy"]) if not fruit_row.empty else float("nan")
    leaf_accuracy = float(leaf_row.iloc[0]["accuracy"]) if not leaf_row.empty else float("nan")

    return {
        "total_images": total_images,
        "processed_images": processed_images,
        "organ_accuracy": organ_accuracy,
        "label_accuracy": label_accuracy,
        "fruit_accuracy": fruit_accuracy,
        "leaf_accuracy": leaf_accuracy,
        "top1_majority_agreement_rate": top1_majority_agreement_rate,
    }


def extract_class_summary(summary_df: pd.DataFrame) -> pd.DataFrame:
    class_df = summary_df.loc[summary_df["summary_type"] == "class"].copy()
    class_df = class_df.sort_values(
        by=["accuracy", "wrong", "expected_organ", "expected_label"],
        ascending=[True, False, True, True],
    ).reset_index(drop=True)
    return class_df


def build_table_markdown(dataframe: pd.DataFrame, columns: list[str], rename_map: dict[str, str]) -> str:
    table_df = dataframe.loc[:, columns].copy()
    table_df = table_df.rename(columns=rename_map)
    return dataframe_to_markdown(table_df)


def dataframe_to_markdown(dataframe: pd.DataFrame) -> str:
    markdown_df = dataframe.fillna("n/a").copy()
    headers = [str(column) for column in markdown_df.columns]
    separator = ["---"] * len(headers)

    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(separator) + " |",
    ]

    for row in markdown_df.itertuples(index=False):
        values = [str(value) for value in row]
        lines.append("| " + " | ".join(values) + " |")

    return "\n".join(lines)


def build_weak_class_notes(class_df: pd.DataFrame) -> list[str]:
    weak_df = class_df.sort_values(by=["accuracy", "total"], ascending=[True, True]).head(5)
    notes: list[str] = []

    for row in weak_df.itertuples(index=False):
        reasons: list[str] = []
        if int(row.total) < 40:
            reasons.append("limited sample count")
        if float(row.accuracy) < 0.80:
            reasons.append("weak retrieval separation in the current reference set")
        if float(row.average_top1_score) < 0.80:
            reasons.append("lower average similarity on retrieved top-1 matches")
        if row.expected_label in {"catfaced", "fruit_cracking"}:
            reasons.append("subtle visual defects may be harder to represent")
        if row.expected_label == "blossom_end_rot":
            reasons.append("dark lesion-like regions may overlap with other fruit disease patterns")
        if row.expected_label == "leaf_curl":
            reasons.append("leaf deformation patterns may overlap with other morphology-driven classes")

        reason_text = "; ".join(reasons) if reasons else "performance should be monitored"
        notes.append(
            f"`{row.expected_label}` ({row.expected_organ}) had {format_pct(float(row.accuracy))} "
            f"accuracy over {int(row.total)} samples; likely contributors include {reason_text}."
        )

    highlighted_labels = ["catfaced", "fruit_cracking", "blossom_end_rot", "leaf_curl"]
    present_weak = [
        label
        for label in highlighted_labels
        if label in set(weak_df["expected_label"].astype(str))
    ]
    if present_weak:
        notes.append(
            "The requested weak-class watchlist appears in the lower-performing group: "
            + ", ".join(f"`{label}`" for label in present_weak)
            + "."
        )

    return notes


def build_strong_class_notes(class_df: pd.DataFrame) -> list[str]:
    strong_df = class_df.sort_values(
        by=["accuracy", "correct", "average_top1_score"],
        ascending=[False, False, False],
    ).head(5)
    notes: list[str] = []
    for row in strong_df.itertuples(index=False):
        notes.append(
            f"`{row.expected_label}` ({row.expected_organ}) reached {format_pct(float(row.accuracy))} "
            f"accuracy over {int(row.total)} samples with average top-1 similarity "
            f"{format_score(row.average_top1_score)}."
        )
    return notes


def build_confusion_notes(confusion_df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    error_pairs = confusion_df.loc[confusion_df["is_error"]].copy()
    top_pairs = error_pairs.head(10).reset_index(drop=True)
    notes: list[str] = []

    for row in top_pairs.itertuples(index=False):
        pair_key = frozenset({row.expected_label, row.final_label})
        hint = SIMILARITY_HINTS.get(pair_key)
        if hint is None:
            hint = (
                "This pattern may reflect either visual similarity between categories, "
                "imbalanced reference coverage, or limited discriminative detail in the current embedding space."
            )
        notes.append(
            f"`{row.expected_label} -> {row.final_label}` occurred {int(row.count)} times. {hint}"
        )

    return top_pairs, notes


def build_error_score_sections(results_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    errors_df = results_df.loc[~results_df["label_correct"]].copy()
    errors_df = errors_df.dropna(subset=["top1_score_numeric"]).copy()

    high_conf_errors = errors_df.loc[errors_df["top1_score_numeric"] >= 0.85].copy()
    high_conf_errors = high_conf_errors.sort_values(
        by=["top1_score_numeric", "expected_label"],
        ascending=[False, True],
    ).head(10)

    low_conf_errors = errors_df.loc[errors_df["top1_score_numeric"] < 0.70].copy()
    low_conf_errors = low_conf_errors.sort_values(
        by=["top1_score_numeric", "expected_label"],
        ascending=[True, True],
    ).head(10)

    return high_conf_errors, low_conf_errors


def table_for_error_examples(error_df: pd.DataFrame) -> str:
    if error_df.empty:
        return "No rows met this criterion."

    table_df = error_df.loc[
        :,
        ["expected_organ", "expected_label", "final_label", "top1_score_numeric", "majority_label"],
    ].copy()
    table_df = table_df.rename(
        columns={
            "expected_organ": "organ",
            "expected_label": "expected_label",
            "final_label": "predicted_label",
            "top1_score_numeric": "top1_similarity_score",
            "majority_label": "majority_label",
        }
    )
    table_df["top1_similarity_score"] = table_df["top1_similarity_score"].map(lambda value: f"{value:.4f}")
    return dataframe_to_markdown(table_df)


def write_report(
    output_path: Path,
    executive_summary: dict,
    class_df: pd.DataFrame,
    weak_notes: list[str],
    strong_notes: list[str],
    top_confusions: pd.DataFrame,
    confusion_notes: list[str],
    high_conf_errors: pd.DataFrame,
    low_conf_errors: pd.DataFrame,
) -> None:
    per_class_table = build_table_markdown(
        class_df.sort_values(by=["expected_organ", "expected_label"]).reset_index(drop=True),
        columns=[
            "expected_organ",
            "expected_label",
            "total",
            "correct",
            "wrong",
            "accuracy",
            "average_top1_score",
        ],
        rename_map={
            "expected_organ": "organ",
            "expected_label": "label",
            "total": "total",
            "correct": "correct",
            "wrong": "wrong",
            "accuracy": "accuracy",
            "average_top1_score": "average_top1_similarity_score",
        },
    )

    top_confusions_table = build_table_markdown(
        top_confusions,
        columns=["expected_organ", "expected_label", "final_label", "count"],
        rename_map={
            "expected_organ": "organ",
            "expected_label": "expected_label",
            "final_label": "predicted_label",
            "count": "count",
        },
    )

    report_lines = [
        "# AI FAISS Evaluation Report",
        "",
        "## Executive Summary",
        f"- Total images: {executive_summary['total_images']}",
        f"- Processed images: {executive_summary['processed_images']}",
        f"- Organ accuracy: {format_pct(executive_summary['organ_accuracy'])}",
        f"- Label accuracy: {format_pct(executive_summary['label_accuracy'])}",
        f"- Fruit accuracy: {format_pct(executive_summary['fruit_accuracy'])}",
        f"- Leaf accuracy: {format_pct(executive_summary['leaf_accuracy'])}",
        (
            "- Top1-majority agreement rate: "
            f"{format_pct(executive_summary['top1_majority_agreement_rate'])}"
        ),
        "",
        "This report was generated automatically from saved CSV outputs. No manual visual audit was performed.",
        "",
        "## Per-Class Performance Table",
        per_class_table,
        "",
        "## Weak Classes",
    ]

    report_lines.extend(f"- {note}" for note in weak_notes)
    report_lines.extend(
        [
            "",
            "## Strong Classes",
        ]
    )
    report_lines.extend(f"- {note}" for note in strong_notes)
    report_lines.extend(
        [
            "",
            "## Confusion Analysis",
            top_confusions_table,
            "",
        ]
    )
    report_lines.extend(f"- {note}" for note in confusion_notes)
    report_lines.extend(
        [
            "",
            "## Automatic Error Interpretation",
            "- The patterns below are inference-based interpretations from counts and scores only, not conclusions from manual image review.",
            "- Low-sample classes can remain unstable because FAISS retrieval quality depends on reference coverage as well as embedding separability.",
            "- Visually similar disease symptoms can drive systematic confusion when lesion color, texture, or shape overlap across labels.",
            "- Subtle defect classes may be harder than large, high-contrast disease patterns because the embedding is global and the baseline assumes one fruit or one leaf per image.",
            "- Similar leaf deformation patterns can create confusion even when organ routing is correct, because retrieval still depends on morphology present in the reference set.",
            "",
            "## High-Confidence Errors",
            "High-score mistakes may indicate visually similar classes, near-duplicate patterns across labels, or possible label noise. They should not be treated as proof of label noise.",
            "",
            table_for_error_examples(high_conf_errors),
            "",
            "## Low-Score Errors",
            "Low-score mistakes may indicate out-of-distribution images, poor visual matches in the FAISS reference set, or weak representation for that class in the retrieval index.",
            "",
            table_for_error_examples(low_conf_errors),
            "",
            "## Recommendations",
            "- Collect more samples for weaker classes, especially where total count is small or error counts are concentrated.",
            "- Rebalance underrepresented classes where possible so the retrieval reference set has better coverage.",
            "- Review labels for weaker classes later, especially for repeated high-similarity confusions, but do not assume label noise without manual verification.",
            "- Keep `final_label = top1_label` for the current baseline because the current evaluation flow is explicitly top1-driven.",
            "- Keep `majority_label` as supporting evidence only rather than the main decision rule.",
            "- Do not change the architecture yet; first improve data coverage and reference-set quality for the weak classes.",
            "",
            "## Limitations",
            "- No manual visual audit was performed for this report.",
            "- Similarity scores are cosine similarity scores, not classifier probabilities.",
            "- FAISS retrieval quality depends on the quality and coverage of the reference dataset.",
            "- The current baseline assumes one fruit or one leaf per image.",
        ]
    )

    output_path.write_text("\n".join(report_lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()

    results_path, results_df = load_csv(args.results_csv, RESULTS_REQUIRED_COLUMNS, "results CSV")
    confusion_path, confusion_df = load_csv(args.confusion_csv, CONFUSION_REQUIRED_COLUMNS, "confusion CSV")
    error_summary_path, error_summary_df = load_csv(
        args.error_summary_csv,
        ERROR_SUMMARY_REQUIRED_COLUMNS,
        "error summary CSV",
    )

    results_df = normalize_results(results_df)
    confusion_df = normalize_confusion(confusion_df)
    error_summary_df = normalize_error_summary(error_summary_df)

    executive_summary = build_executive_summary(results_df, error_summary_df)
    class_df = extract_class_summary(error_summary_df)
    weak_notes = build_weak_class_notes(class_df)
    strong_notes = build_strong_class_notes(class_df)
    top_confusions, confusion_notes = build_confusion_notes(confusion_df)
    high_conf_errors, low_conf_errors = build_error_score_sections(results_df)

    output_path = Path(args.output_md).expanduser().resolve()
    write_report(
        output_path=output_path,
        executive_summary=executive_summary,
        class_df=class_df,
        weak_notes=weak_notes,
        strong_notes=strong_notes,
        top_confusions=top_confusions,
        confusion_notes=confusion_notes,
        high_conf_errors=high_conf_errors,
        low_conf_errors=low_conf_errors,
    )

    print("[REPORT GENERATED]")
    print(f"results_csv: {results_path}")
    print(f"confusion_csv: {confusion_path}")
    print(f"error_summary_csv: {error_summary_path}")
    print(f"output_md: {output_path}")


if __name__ == "__main__":
    main()
