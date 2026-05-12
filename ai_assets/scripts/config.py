from pathlib import Path

# =========================
# PATHS
# =========================
PROJECT_ROOT = Path(__file__).resolve().parent.parent

RAW_DATASETS_DIR = PROJECT_ROOT / "raw_datasets"
METADATA_DIR = PROJECT_ROOT / "metadata"
DATASET_FINAL_DIR = PROJECT_ROOT / "dataset_final"

MASTER_METADATA_CSV = METADATA_DIR / "master_metadata.csv"
FINAL_METADATA_CSV = METADATA_DIR / "final_metadata.csv"

# =========================
# DATASET SOURCES
# =========================
SOURCES = {
    "mendeley": RAW_DATASETS_DIR / "mendeley",
    "roboflow": RAW_DATASETS_DIR / "roboflow",
    "kaggle": RAW_DATASETS_DIR / "kaggle",
}

# =========================
# LABEL NORMALIZATION
# =========================
LABEL_MAP = {
    # ===== KAGGLE =====
    "Anthracnose": "anthracnose",
    "Blossom_End_Rot": "blossom_end_rot",
    "Catfaced": "catfaced",
    "Fruit_Cracking": "fruit_cracking",
    "Healthy_Tomato": "healthy",
    "Late_Blight": "late_blight",
    "Mold": "mold",
    "Spotted_Wilt_Virus": "spotted_wilt_virus",

    # ===== ROBOFLOW =====
    "Anthracnose_multiple": "anthracnose",
    "Bacterial_Spot": "bacterial_spot",
    "Bacterial_Spot_multiple": "bacterial_spot",
    "Blossom end rot": "blossom_end_rot",
    "Blossom end rot_multiple": "blossom_end_rot",
    "Healthy Tomato": "healthy",
    "Healthy Tomato_multiple": "healthy",
    "Spotted wilt Virus": "spotted_wilt_virus",
    "Spotted wilt Virus_multiple": "spotted_wilt_virus",

    # ===== MENDELEY FRUIT =====
    "Healthy Fruits": "healthy",
    "Target Spot Fruits": "target_spot",

    # ===== MENDELEY LEAF =====
    "Healthy Leaf": "healthy",
    "Early Blight Leaf": "early_blight",
    "Late Blight Leaf": "late_blight",
    "Leaf Curl Leaf": "leaf_curl",
    "Bushy Stunt Leaf": "bushy_stunt",
}

# =========================
# LABELS TO SKIP
# =========================
SKIP_LABELS = {
    "empty",
    "Anthracnose_multiple Blossom end rot",
    "Anthracnose Spotted wilt Virus",
    "Blossom end rot Healthy Tomato",
    "Blossom end rot Healthy Tomato_multiple",
    "Healthy Tomato Spotted wilt Virus_multiple",
}

# =========================
# IMAGE EXTENSIONS
# =========================
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# =========================
# ORGAN DETECTION
# =========================
def detect_organ_from_label(original_label: str, source: str) -> str:
    lbl = original_label.lower()

    if source == "kaggle":
        return "fruit"

    if "leaf" in lbl:
        return "leaf"

    if "fruit" in lbl or "tomato" in lbl:
        return "fruit"


    if source == "roboflow":
        return "fruit"


    return "fruit"

# =========================
# KAGGLE YOLO CLASS NAMES
# =========================
KAGGLE_CLASS_NAMES = [
    "Anthracnose",
    "Blossom_End_Rot",
    "Catfaced",
    "Fruit_Cracking",
    "Healthy_Tomato",
    "Late_Blight",
    "Mold",
    "Spotted_Wilt_Virus",
]

EMBEDDINGS_DIR = PROJECT_ROOT / "embeddings"

FRUIT_EMBEDDINGS_NPY = EMBEDDINGS_DIR / "fruit_embeddings.npy"
LEAF_EMBEDDINGS_NPY = EMBEDDINGS_DIR / "leaf_embeddings.npy"

FRUIT_METADATA_CSV = METADATA_DIR / "fruit_metadata.csv"
LEAF_METADATA_CSV = METADATA_DIR / "leaf_metadata.csv"
ORGAN_METADATA_CSV = METADATA_DIR / "organ_metadata.csv"

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32

INDEXES_DIR = PROJECT_ROOT / "indexes"

FRUIT_FAISS_INDEX = INDEXES_DIR / "fruit_faiss.index"
LEAF_FAISS_INDEX = INDEXES_DIR / "leaf_faiss.index"
ORGAN_FAISS_INDEX = INDEXES_DIR / "organ_faiss.index"
