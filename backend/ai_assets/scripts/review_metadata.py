import pandas as pd
from config import MASTER_METADATA_CSV

def main():
    df = pd.read_csv(MASTER_METADATA_CSV)

    print("\n=== HEAD ===")
    print(df.head())

    print("\n=== TOTAL ROWS ===")
    print(len(df))

    print("\n=== BY SOURCE ===")
    print(df["source"].value_counts())

    print("\n=== BY SOURCE TYPE ===")
    print(df["source_type"].value_counts())

    print("\n=== BY ORGAN ===")
    print(df["organ"].value_counts())

    print("\n=== BY LABEL ===")
    print(df["label"].value_counts())

    print("\n=== BY SOURCE + LABEL ===")
    print(df.groupby(["source", "label"]).size().sort_values(ascending=False))

    print("\n=== CROP NEEDED ===")
    print(df["is_crop_needed"].value_counts())

    print("\n=== MISSING LABELS ===")
    print(df[df["label"].isna()])

if __name__ == "__main__":
    main()