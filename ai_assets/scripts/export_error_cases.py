import argparse
import shutil
from pathlib import Path

import pandas as pd


DEFAULT_INPUT_CSV = "evaluation_results_test_only.csv"
DEFAULT_OUTPUT_DIR = "error_review"
SUMMARY_CSV_NAME = "error_cases_summary.csv"

REQUIRED_COLUMNS = {
    "image_path",
    "expected_organ",
    "expected_label",
    "predicted_organ",
    "final_label",
    "top1_label",
    "top1_score",
    "majority_label",
    "majority_vote",
    "support_status",
    "label_correct",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export misclassified evaluation images into organized review folders."
    )
    parser.add_argument(
        "--csv",
        default=DEFAULT_INPUT_CSV,
        help=f"Path to the evaluation CSV. Default: {DEFAULT_INPUT_CSV}",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory where misclassified images will be copied. Default: {DEFAULT_OUTPUT_DIR}",
    )
    return parser.parse_args()


def ensure_required_columns(dataframe: pd.DataFrame) -> None:
    missing_columns = sorted(REQUIRED_COLUMNS - set(dataframe.columns))
    if missing_columns:
        raise ValueError(f"Evaluation CSV is missing required columns: {missing_columns}")


def sanitize_text(value: str) -> str:
    text = str(value).strip()
    for old, new in (
        ("\\", "_"),
        ("/", "_"),
        (":", "_"),
        ("*", "_"),
        ("?", "_"),
        ('"', "_"),
        ("<", "_"),
        (">", "_"),
        ("|", "_"),
        (" ", "_"),
    ):
        text = text.replace(old, new)
    return text or "unknown"


def parse_label_correct_series(dataframe: pd.DataFrame) -> pd.Series:
    parsed = dataframe["label_correct"].astype(str).str.lower().map(
        {"true": True, "false": False}
    )
    if parsed.isna().any():
        raise ValueError("label_correct contains non-boolean values")
    return parsed


def make_output_filename(image_path: Path, expected_label: str, final_label: str, top1_score) -> str:
    score_value = pd.to_numeric(pd.Series([top1_score]), errors="coerce").iloc[0]
    score_text = "nan" if pd.isna(score_value) else f"{float(score_value):.4f}"
    return (
        f"{image_path.stem}"
        f"__expected_{sanitize_text(expected_label)}"
        f"__predicted_{sanitize_text(final_label)}"
        f"__score_{score_text}"
        f"{image_path.suffix}"
    )


def build_summary_row(row: pd.Series, copied_path: Path) -> dict:
    return {
        "image_path": str(Path(str(row["image_path"])).expanduser()),
        "expected_organ": str(row["expected_organ"]),
        "expected_label": str(row["expected_label"]),
        "predicted_organ": str(row["predicted_organ"]),
        "final_label": str(row["final_label"]),
        "top1_label": str(row["top1_label"]),
        "top1_score": row["top1_score"],
        "majority_label": str(row["majority_label"]),
        "majority_vote": str(row["majority_vote"]),
        "support_status": str(row["support_status"]),
        "copied_path": str(copied_path),
    }


def copy_error_cases(errors_df: pd.DataFrame, output_dir: Path) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_rows: list[dict] = []

    for row in errors_df.itertuples(index=False):
        image_path = Path(str(row.image_path)).expanduser().resolve()
        if not image_path.exists():
            raise FileNotFoundError(f"Missing source image referenced in CSV: {image_path}")

        final_label = str(row.final_label).strip() or "no_prediction"
        destination_dir = (
            output_dir
            / sanitize_text(str(row.expected_organ))
            / sanitize_text(str(row.expected_label))
            / f"predicted_{sanitize_text(final_label)}"
        )
        destination_dir.mkdir(parents=True, exist_ok=True)

        output_filename = make_output_filename(
            image_path=image_path,
            expected_label=str(row.expected_label),
            final_label=final_label,
            top1_score=row.top1_score,
        )
        destination_path = destination_dir / output_filename
        shutil.copy2(image_path, destination_path)

        summary_rows.append(build_summary_row(pd.Series(row._asdict()), destination_path))

    return summary_rows


def print_summary(errors_df: pd.DataFrame, output_dir: Path) -> None:
    confusion_pairs = (
        errors_df.groupby(["expected_label", "final_label"], dropna=False)
        .size()
        .reset_index(name="count")
        .sort_values(by=["count", "expected_label", "final_label"], ascending=[False, True, True])
    )
    errors_by_label = (
        errors_df.groupby("expected_label", dropna=False)
        .size()
        .reset_index(name="count")
        .sort_values(by=["count", "expected_label"], ascending=[False, True])
    )

    print("[ERROR EXPORT]")
    print(f"total_errors: {len(errors_df)}")
    print(f"output_dir: {output_dir}")

    print()
    print("[TOP CONFUSION PAIRS]")
    if confusion_pairs.empty:
        print("No error rows found.")
    else:
        for row in confusion_pairs.head(20).itertuples(index=False):
            print(f"{row.expected_label} -> {row.final_label} | count={row.count}")

    print()
    print("[ERRORS BY EXPECTED LABEL]")
    if errors_by_label.empty:
        print("No error rows found.")
    else:
        for row in errors_by_label.itertuples(index=False):
            print(f"{row.expected_label} | count={row.count}")


def main() -> None:
    args = parse_args()

    csv_path = Path(args.csv).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    if not csv_path.exists():
        raise FileNotFoundError(f"Evaluation CSV does not exist: {csv_path}")

    dataframe = pd.read_csv(csv_path)
    ensure_required_columns(dataframe)

    label_correct = parse_label_correct_series(dataframe)
    errors_df = dataframe.loc[~label_correct].copy().reset_index(drop=True)

    summary_rows = copy_error_cases(errors_df, output_dir)

    summary_output_path = output_dir / SUMMARY_CSV_NAME
    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(summary_output_path, index=False)

    print_summary(errors_df, output_dir)
    print()
    print("[OUTPUT FILES]")
    print(f"summary_csv: {summary_output_path}")


if __name__ == "__main__":
    main()
