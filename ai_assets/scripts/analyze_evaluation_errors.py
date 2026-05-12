import argparse
from pathlib import Path

import pandas as pd


DEFAULT_INPUT_CSV = "evaluation_results_test_only.csv"
DEFAULT_SUMMARY_CSV = "evaluation_error_summary.csv"
DEFAULT_CONFUSION_CSV = "evaluation_confusion_pairs.csv"
NO_PREDICTION_LABEL = "no_prediction"

REQUIRED_COLUMNS = {
    "expected_organ",
    "expected_label",
    "final_label",
    "top1_score",
    "label_correct",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze a saved evaluation CSV and print error analysis without rerunning inference."
    )
    parser.add_argument(
        "--csv",
        default=DEFAULT_INPUT_CSV,
        help=f"Path to the evaluation CSV. Default: {DEFAULT_INPUT_CSV}",
    )
    return parser.parse_args()


def ensure_required_columns(dataframe: pd.DataFrame) -> None:
    missing_columns = sorted(REQUIRED_COLUMNS - set(dataframe.columns))
    if missing_columns:
        raise ValueError(f"Evaluation CSV is missing required columns: {missing_columns}")


def normalize_dataframe(dataframe: pd.DataFrame) -> pd.DataFrame:
    normalized = dataframe.copy()
    normalized["expected_organ"] = normalized["expected_organ"].fillna("").astype(str)
    normalized["expected_label"] = normalized["expected_label"].fillna("").astype(str)
    normalized["final_label"] = normalized["final_label"].fillna("").astype(str)
    normalized["final_label_display"] = normalized["final_label"].replace("", NO_PREDICTION_LABEL)
    normalized["label_correct"] = normalized["label_correct"].astype(str).str.lower().map(
        {"true": True, "false": False}
    )
    if normalized["label_correct"].isna().any():
        raise ValueError("label_correct contains non-boolean values")

    normalized["top1_score_numeric"] = pd.to_numeric(
        normalized["top1_score"],
        errors="coerce",
    )
    return normalized


def compute_global_summary(dataframe: pd.DataFrame) -> dict:
    total = int(len(dataframe))
    correct = int(dataframe["label_correct"].sum())
    wrong = total - correct
    accuracy = (correct / total) if total else 0.0
    average_top1_score = float(dataframe["top1_score_numeric"].dropna().mean()) if total else float("nan")
    return {
        "summary_type": "global",
        "expected_organ": "",
        "expected_label": "",
        "total": total,
        "correct": correct,
        "wrong": wrong,
        "accuracy": accuracy,
        "average_top1_score": average_top1_score,
    }


def compute_organ_summary(dataframe: pd.DataFrame) -> list[dict]:
    summaries: list[dict] = []
    for expected_organ, group in dataframe.groupby("expected_organ", sort=True):
        total = int(len(group))
        correct = int(group["label_correct"].sum())
        wrong = total - correct
        accuracy = (correct / total) if total else 0.0
        average_top1_score = float(group["top1_score_numeric"].dropna().mean()) if total else float("nan")
        summaries.append(
            {
                "summary_type": "organ",
                "expected_organ": expected_organ,
                "expected_label": "",
                "total": total,
                "correct": correct,
                "wrong": wrong,
                "accuracy": accuracy,
                "average_top1_score": average_top1_score,
            }
        )
    return summaries


def compute_class_summary(dataframe: pd.DataFrame) -> list[dict]:
    summaries: list[dict] = []
    grouped = dataframe.groupby(["expected_organ", "expected_label"], sort=True)
    for (expected_organ, expected_label), group in grouped:
        total = int(len(group))
        correct = int(group["label_correct"].sum())
        wrong = total - correct
        accuracy = (correct / total) if total else 0.0
        average_top1_score = float(group["top1_score_numeric"].dropna().mean()) if total else float("nan")
        summaries.append(
            {
                "summary_type": "class",
                "expected_organ": expected_organ,
                "expected_label": expected_label,
                "total": total,
                "correct": correct,
                "wrong": wrong,
                "accuracy": accuracy,
                "average_top1_score": average_top1_score,
            }
        )
    return summaries


def compute_confusion_pairs(dataframe: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        dataframe.groupby(
            ["expected_organ", "expected_label", "final_label_display"],
            dropna=False,
            sort=True,
        )
        .size()
        .reset_index(name="count")
        .rename(columns={"final_label_display": "final_label"})
    )
    grouped["is_error"] = grouped["expected_label"] != grouped["final_label"]
    grouped = grouped.sort_values(
        by=["count", "expected_organ", "expected_label", "final_label"],
        ascending=[False, True, True, True],
    ).reset_index(drop=True)
    return grouped


def print_accuracy_sections(
    global_summary: dict,
    organ_summary: list[dict],
    class_summary: list[dict],
) -> None:
    print("[GLOBAL ACCURACY]")
    print(f"total: {global_summary['total']}")
    print(f"correct: {global_summary['correct']}")
    print(f"wrong: {global_summary['wrong']}")
    print(f"accuracy: {global_summary['accuracy']:.4f}")

    print()
    print("[ACCURACY BY ORGAN]")
    for row in organ_summary:
        print(
            f"{row['expected_organ']} | total={row['total']} | correct={row['correct']} | "
            f"wrong={row['wrong']} | accuracy={row['accuracy']:.4f}"
        )

    print()
    print("[ACCURACY BY CLASS]")
    for row in class_summary:
        average_score_text = (
            f"{row['average_top1_score']:.4f}"
            if pd.notna(row["average_top1_score"])
            else "n/a"
        )
        print(
            f"{row['expected_organ']} | {row['expected_label']} | total={row['total']} | "
            f"correct={row['correct']} | wrong={row['wrong']} | "
            f"accuracy={row['accuracy']:.4f} | average_top1_score={average_score_text}"
        )


def print_confusion_sections(confusion_pairs: pd.DataFrame) -> None:
    print()
    print("[CONFUSION PAIRS]")
    for row in confusion_pairs.itertuples(index=False):
        print(
            f"{row.expected_organ} | {row.expected_label} -> {row.final_label} | count={row.count}"
        )

    error_pairs = confusion_pairs.loc[confusion_pairs["is_error"]].copy()
    top_errors = error_pairs.head(20)

    print()
    print("[TOP 20 MOST COMMON ERRORS]")
    if top_errors.empty:
        print("No label errors found.")
        return

    for row in top_errors.itertuples(index=False):
        print(
            f"{row.expected_organ} | {row.expected_label} -> {row.final_label} | count={row.count}"
        )


def save_summary_csv(
    global_summary: dict,
    organ_summary: list[dict],
    class_summary: list[dict],
    output_path: Path,
) -> None:
    summary_rows = [global_summary] + organ_summary + class_summary
    summary_dataframe = pd.DataFrame(summary_rows)
    summary_dataframe.to_csv(output_path, index=False)


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv).expanduser().resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"Evaluation CSV does not exist: {csv_path}")

    dataframe = pd.read_csv(csv_path)
    ensure_required_columns(dataframe)
    dataframe = normalize_dataframe(dataframe)

    global_summary = compute_global_summary(dataframe)
    organ_summary = compute_organ_summary(dataframe)
    class_summary = compute_class_summary(dataframe)
    confusion_pairs = compute_confusion_pairs(dataframe)

    print(f"input_csv: {csv_path}")
    print_accuracy_sections(global_summary, organ_summary, class_summary)
    print_confusion_sections(confusion_pairs)

    summary_output_path = csv_path.parent / DEFAULT_SUMMARY_CSV
    confusion_output_path = csv_path.parent / DEFAULT_CONFUSION_CSV
    save_summary_csv(global_summary, organ_summary, class_summary, summary_output_path)
    confusion_pairs.to_csv(confusion_output_path, index=False)

    print()
    print("[OUTPUT FILES]")
    print(f"summary_csv: {summary_output_path}")
    print(f"confusion_pairs_csv: {confusion_output_path}")


if __name__ == "__main__":
    main()
