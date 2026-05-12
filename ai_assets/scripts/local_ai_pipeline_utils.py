import json
import logging
import os
import pickle
import subprocess
import tempfile
import time
from pathlib import Path

import faiss
import numpy as np
import pandas as pd

from config import IMAGE_SIZE, PROJECT_ROOT


EXPECTED_FEATURE_DIM = 1280
NORM_ATOL = 1e-3
DEFAULT_RETRIEVAL_THRESHOLDS = {
    "min_top1_score": 0.65,
    "min_majority_vote_ratio": 0.60,
    "require_top1_majority_match": True,
    "require_majority_weighted_match": True,
}

LOGGER = logging.getLogger("ai_assets.local_ai_pipeline_utils")

_MOBILENET_MODEL = None
_TENSORFLOW_STACK = None
_JSON_FILE_CACHE: dict[Path, dict] = {}
_INDEX_AND_METADATA_CACHE: dict[tuple[Path, Path], tuple[faiss.Index, pd.DataFrame]] = {}
_CLASSIFIER_CACHE: dict[Path, object] = {}


def _load_tensorflow_stack():
    global _TENSORFLOW_STACK

    if _TENSORFLOW_STACK is None:
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
        os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

        import cv2
        from absl import logging as absl_logging
        import tensorflow as tf

        preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input
        tf.get_logger().setLevel("ERROR")
        absl_logging.set_verbosity(absl_logging.ERROR)
        absl_logging.set_stderrthreshold("error")
        _TENSORFLOW_STACK = (cv2, preprocess_input, tf)

    return _TENSORFLOW_STACK


def ensure_file_exists(path: Path, description: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")


def resolve_assets_dir(assets_dir: str | Path | None = None) -> Path:
    base_dir = PROJECT_ROOT if assets_dir is None else assets_dir
    resolved = Path(base_dir).expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Assets directory does not exist: {resolved}")
    return resolved


def resolve_path_from_assets(assets_dir: str | Path | None, path_value: str | Path) -> Path:
    resolved_assets_dir = resolve_assets_dir(assets_dir)
    candidate_path = Path(path_value).expanduser()
    if not candidate_path.is_absolute():
        candidate_path = resolved_assets_dir / candidate_path
    return candidate_path.resolve()


def resolve_pipeline_paths(assets_dir: str | Path | None = None) -> dict[str, Path]:
    resolved_assets_dir = resolve_assets_dir(assets_dir)
    paths = {
        "assets_dir": resolved_assets_dir,
        "organ_index": resolved_assets_dir / "indexes" / "organ_faiss.index",
        "organ_metadata": resolved_assets_dir / "metadata" / "organ_metadata.csv",
        "fruit_index": resolved_assets_dir / "indexes" / "fruit_faiss.index",
        "leaf_index": resolved_assets_dir / "indexes" / "leaf_faiss.index",
        "fruit_metadata": resolved_assets_dir / "metadata" / "fruit_metadata.csv",
        "leaf_metadata": resolved_assets_dir / "metadata" / "leaf_metadata.csv",
    }

    ensure_file_exists(paths["organ_index"], "organ FAISS index")
    ensure_file_exists(paths["organ_metadata"], "organ metadata CSV")
    ensure_file_exists(paths["fruit_index"], "fruit FAISS index")
    ensure_file_exists(paths["leaf_index"], "leaf FAISS index")
    ensure_file_exists(paths["fruit_metadata"], "fruit metadata CSV")
    ensure_file_exists(paths["leaf_metadata"], "leaf metadata CSV")
    return paths


def select_disease_resources(assets_dir: str | Path | None, organ: str) -> tuple[Path, Path]:
    paths = resolve_pipeline_paths(assets_dir)

    if organ == "fruit":
        return paths["fruit_index"], paths["fruit_metadata"]

    if organ == "leaf":
        return paths["leaf_index"], paths["leaf_metadata"]

    raise ValueError(f"organ must be either 'fruit' or 'leaf', got: {organ}")


def load_mobilenet_model():
    global _MOBILENET_MODEL

    if _MOBILENET_MODEL is None:
        _cv2, _preprocess_input, tf = _load_tensorflow_stack()
        _MOBILENET_MODEL = tf.keras.applications.MobileNetV2(
            weights="imagenet",
            include_top=False,
            pooling="avg",
            input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3),
        )

    return _MOBILENET_MODEL


def load_json_file(path: str | Path) -> dict:
    resolved_path = Path(path).expanduser().resolve()
    ensure_file_exists(resolved_path, "JSON file")

    cached_payload = _JSON_FILE_CACHE.get(resolved_path)
    if cached_payload is not None:
        return cached_payload

    with resolved_path.open("r", encoding="utf-8") as file_handle:
        payload = json.load(file_handle)

    _JSON_FILE_CACHE[resolved_path] = payload
    return payload


def _load_classifier_model(classifier_path: Path):
    resolved_classifier_path = classifier_path.resolve()
    cached_classifier = _CLASSIFIER_CACHE.get(resolved_classifier_path)
    if cached_classifier is not None:
        LOGGER.debug("Reusing cached organ classifier path=%s", resolved_classifier_path)
        return cached_classifier

    LOGGER.info("Loading organ classifier path=%s", resolved_classifier_path)
    load_started_at = time.perf_counter()
    with resolved_classifier_path.open("rb") as classifier_file:
        classifier = pickle.load(classifier_file)
    _CLASSIFIER_CACHE[resolved_classifier_path] = classifier
    LOGGER.info(
        "Loaded organ classifier path=%s duration_seconds=%.3f",
        resolved_classifier_path,
        time.perf_counter() - load_started_at,
    )
    return classifier


def _read_faiss_index(index_path: Path) -> faiss.Index:
    resolved_index_path = index_path.resolve()
    io_flags = int(getattr(faiss, "IO_FLAG_MMAP", 0)) | int(
        getattr(faiss, "IO_FLAG_READ_ONLY", 0)
    )

    if io_flags:
        try:
            LOGGER.info(
                "Loading FAISS index with mmap path=%s io_flags=%s",
                resolved_index_path,
                io_flags,
            )
            return faiss.read_index(str(resolved_index_path), io_flags)
        except TypeError:
            LOGGER.debug(
                "FAISS mmap flags are not supported by this faiss build, falling back to regular read"
            )
        except Exception as exc:
            LOGGER.warning(
                "FAISS mmap read failed path=%s reason=%s; falling back to regular read",
                resolved_index_path,
                exc,
            )

    LOGGER.info("Loading FAISS index path=%s", resolved_index_path)
    return faiss.read_index(str(resolved_index_path))


def l2_normalize(vectors: np.ndarray, eps: float = 1e-10) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return vectors / norms


def _validate_feature_vector(vector: np.ndarray) -> tuple[np.ndarray, int, float]:
    vector = np.asarray(vector, dtype=np.float32)

    if vector.ndim == 2:
        if vector.shape != (1, EXPECTED_FEATURE_DIM):
            raise ValueError(
                f"Wrong feature vector shape: expected (1, {EXPECTED_FEATURE_DIM}), got {vector.shape}"
            )
        vector = vector[0]
    elif vector.ndim == 1:
        if vector.shape[0] != EXPECTED_FEATURE_DIM:
            raise ValueError(
                f"Wrong feature vector shape: expected ({EXPECTED_FEATURE_DIM},), got {vector.shape}"
            )
    else:
        raise ValueError(
            f"Invalid feature vector shape: expected 1D or 2D vector, got {vector.shape}"
        )

    if not np.isfinite(vector).all():
        raise ValueError("Feature vector contains NaN or Inf values")

    vector_norm = float(np.linalg.norm(vector))
    if not np.isclose(vector_norm, 1.0, atol=NORM_ATOL):
        raise ValueError(f"Feature vector norm is not close to 1.0: {vector_norm:.6f}")

    return vector.astype(np.float32), int(vector.shape[0]), vector_norm


def validate_feature_vector(vector: np.ndarray) -> dict:
    validated_vector, feature_dim, vector_norm = _validate_feature_vector(vector)
    return {
        "feature_vector": validated_vector,
        "feature_dim": feature_dim,
        "vector_norm": vector_norm,
    }


def _prepare_query_vector(vector: np.ndarray) -> np.ndarray:
    validated_vector, _feature_dim, _vector_norm = _validate_feature_vector(vector)
    return validated_vector.reshape(1, -1).astype(np.float32)


def _load_and_preprocess_bgr_image(image_bgr: np.ndarray) -> np.ndarray:
    cv2, preprocess_input, _tf = _load_tensorflow_stack()

    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("Input image array is empty")

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, IMAGE_SIZE, interpolation=cv2.INTER_AREA)
    processed = resized.astype(np.float32)
    processed = preprocess_input(processed)
    return processed


def extract_feature_from_bgr_image(
    image_bgr: np.ndarray,
    model=None,
    source_name: str = "in_memory_image",
) -> dict:
    mobilenet_model = load_mobilenet_model() if model is None else model
    processed = _load_and_preprocess_bgr_image(image_bgr)
    batch = np.expand_dims(processed, axis=0).astype(np.float32)

    vector = mobilenet_model(batch, training=False).numpy().astype(np.float32)
    vector = l2_normalize(vector).astype(np.float32)

    validated_vector, feature_dim, vector_norm = _validate_feature_vector(vector)
    return {
        "image_path": source_name,
        "feature_vector": validated_vector,
        "feature_dim": feature_dim,
        "vector_norm": vector_norm,
    }


def extract_feature_from_image(image_path: str | Path, model=None) -> dict:
    resolved_image_path = Path(image_path).expanduser().resolve()
    ensure_file_exists(resolved_image_path, "input image")

    image_bgr = cv2.imread(str(resolved_image_path))
    if image_bgr is None:
        raise ValueError(f"Could not read image with OpenCV: {resolved_image_path}")

    result = extract_feature_from_bgr_image(
        image_bgr=image_bgr,
        model=model,
        source_name=str(resolved_image_path),
    )
    result["image_path"] = str(resolved_image_path)
    return result


def _validate_metadata_columns(
    metadata: pd.DataFrame,
    required_columns: set[str],
    description: str,
) -> None:
    missing_columns = sorted(required_columns - set(metadata.columns))
    if missing_columns:
        raise ValueError(f"{description} is missing required columns: {missing_columns}")


def _load_index_and_metadata(
    index_path: Path,
    metadata_path: Path,
    required_columns: set[str],
    description: str,
) -> tuple[faiss.Index, pd.DataFrame]:
    ensure_file_exists(index_path, f"{description} index")
    ensure_file_exists(metadata_path, f"{description} metadata")

    cache_key = (index_path.resolve(), metadata_path.resolve())
    cached_value = _INDEX_AND_METADATA_CACHE.get(cache_key)
    if cached_value is not None:
        LOGGER.debug(
            "Reusing cached %s assets index_path=%s metadata_path=%s",
            description,
            cache_key[0],
            cache_key[1],
        )
        index, metadata = cached_value
    else:
        LOGGER.info(
            "Loading %s assets index_path=%s metadata_path=%s",
            description,
            cache_key[0],
            cache_key[1],
        )
        load_started_at = time.perf_counter()
        index = _read_faiss_index(index_path)
        metadata = pd.read_csv(metadata_path)
        _INDEX_AND_METADATA_CACHE[cache_key] = (index, metadata)
        LOGGER.info(
            "Loaded %s assets index_path=%s metadata_path=%s rows=%s ntotal=%s duration_seconds=%.3f",
            description,
            cache_key[0],
            cache_key[1],
            len(metadata),
            index.ntotal,
            time.perf_counter() - load_started_at,
        )

    if index.ntotal != len(metadata):
        raise ValueError(
            f"{description} mismatch: index.ntotal={index.ntotal} vs metadata rows={len(metadata)}"
        )

    _validate_metadata_columns(metadata, required_columns, description)
    return index, metadata


def _search_neighbors(
    index: faiss.Index,
    metadata: pd.DataFrame,
    query_vector: np.ndarray,
    top_k: int,
    description: str,
) -> tuple[np.ndarray, np.ndarray]:
    if top_k <= 0:
        raise ValueError(f"{description}: top_k must be a positive integer")

    if top_k > index.ntotal:
        raise ValueError(
            f"{description}: top_k={top_k} is larger than the number of indexed vectors ({index.ntotal})"
        )

    scores, indices = index.search(query_vector, top_k)
    scores = scores[0]
    indices = indices[0]

    if len(indices) != top_k:
        raise RuntimeError(
            f"{description}: FAISS returned {len(indices)} neighbors, expected {top_k}"
        )

    if np.any(indices < 0):
        raise RuntimeError(f"{description}: FAISS returned invalid neighbor indices")

    if np.any(indices >= len(metadata)):
        raise RuntimeError(
            f"{description}: FAISS returned neighbor indices outside metadata bounds"
        )

    return scores, indices


def _make_neighbor_record(
    metadata: pd.DataFrame,
    neighbor_index: int,
    score: float,
    rank: int,
) -> dict:
    row = metadata.iloc[int(neighbor_index)]
    record = {
        "rank": rank,
        "score": float(score),
        "source_row_id": int(row["organ_index_id"]) if "organ_index_id" in metadata.columns else int(neighbor_index),
        "label": str(row["label"]) if "label" in metadata.columns else "",
        "organ": str(row["organ"]) if "organ" in metadata.columns else "",
    }

    for optional_key in ("sample_id", "source", "image_path_final", "original_label", "split"):
        if optional_key in metadata.columns:
            record[optional_key] = row[optional_key]

    return record


def _predict_classifier_probabilities_direct(
    classifier_path: Path,
    query_vector: np.ndarray,
) -> tuple[list[int], list[float]]:
    classifier = _load_classifier_model(classifier_path)
    probabilities = classifier.predict_proba(query_vector)[0]
    classes = [int(class_id) for class_id in classifier.classes_]
    return classes, [float(probability) for probability in probabilities]


def _predict_classifier_probabilities_subprocess(
    classifier_path: Path,
    query_vector: np.ndarray,
) -> tuple[list[int], list[float]]:
    helper_script = """
import json
import pickle
import sys
import numpy as np

classifier_path = sys.argv[1]
vector_path = sys.argv[2]

with open(classifier_path, "rb") as classifier_file:
    classifier = pickle.load(classifier_file)

query_vector = np.load(vector_path).reshape(1, -1).astype(np.float32)
probabilities = classifier.predict_proba(query_vector)[0]
classes = [int(class_id) for class_id in classifier.classes_]
payload = {
    "classes": classes,
    "probabilities": [float(probability) for probability in probabilities],
}
print(json.dumps(payload))
""".strip()

    temp_vector_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".npy",
            delete=False,
            dir=str(PROJECT_ROOT),
        ) as temp_file:
            temp_vector_path = Path(temp_file.name)

        np.save(temp_vector_path, query_vector.astype(np.float32))
        result = subprocess.run(
            ["python", "-c", helper_script, str(classifier_path), str(temp_vector_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout.strip())
        return payload["classes"], payload["probabilities"]
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Could not run fallback system python for organ classifier inference."
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr_text = exc.stderr.strip() if exc.stderr else "no stderr"
        raise RuntimeError(
            "Fallback organ classifier inference failed in system python: "
            f"{stderr_text}"
        ) from exc
    finally:
        if temp_vector_path is not None and temp_vector_path.exists():
            temp_vector_path.unlink()


def run_organ_classifier(
    vector: np.ndarray,
    assets_dir: str | Path | None,
    classifier_path: str | Path,
    labels_path: str | Path,
    min_probability: float = 0.60,
) -> dict:
    if not 0.0 <= min_probability <= 1.0:
        raise ValueError("--min-organ-classifier-proba must be between 0.0 and 1.0")

    query_vector = _prepare_query_vector(vector)
    resolved_classifier_path = resolve_path_from_assets(assets_dir, classifier_path)
    resolved_labels_path = resolve_path_from_assets(assets_dir, labels_path)

    ensure_file_exists(resolved_classifier_path, "organ classifier model")
    ensure_file_exists(resolved_labels_path, "organ classifier labels")

    labels_payload = load_json_file(resolved_labels_path)
    id_to_label = labels_payload.get("id_to_label")
    if not isinstance(id_to_label, dict):
        raise ValueError("Organ classifier labels JSON must contain an 'id_to_label' object")

    try:
        classes, probabilities = _predict_classifier_probabilities_direct(
            resolved_classifier_path,
            query_vector,
        )
    except (ModuleNotFoundError, ImportError):
        classes, probabilities = _predict_classifier_probabilities_subprocess(
            resolved_classifier_path,
            query_vector,
        )

    if len(classes) != len(probabilities):
        raise RuntimeError("Organ classifier returned mismatched classes and probabilities")

    class_probabilities: dict[str, float] = {}
    for class_id, probability in zip(classes, probabilities):
        label = id_to_label.get(str(class_id))
        if label is None:
            raise ValueError(f"Missing label mapping for organ class id: {class_id}")
        class_probabilities[str(label)] = float(probability)

    predicted_organ = max(class_probabilities, key=class_probabilities.get)
    organ_router_probability = class_probabilities[predicted_organ]
    below_threshold = organ_router_probability < min_probability

    return {
        "predicted_organ": "unknown" if below_threshold else predicted_organ,
        "raw_predicted_organ": predicted_organ,
        "organ_router_probability": organ_router_probability,
        "min_probability": min_probability,
        "class_probabilities": class_probabilities,
        "classifier_path": resolved_classifier_path,
        "labels_path": resolved_labels_path,
    }


def _decide_organ(
    fruit_count: int,
    leaf_count: int,
    total_votes: int,
    min_vote_ratio: float,
) -> tuple[str, int, float]:
    if total_votes <= 0:
        raise ValueError("No organ votes available")

    if not 0.0 <= min_vote_ratio <= 1.0:
        raise ValueError("--min-vote-ratio must be between 0.0 and 1.0")

    winning_votes = max(fruit_count, leaf_count)
    vote_ratio = winning_votes / total_votes

    if fruit_count == leaf_count:
        return "unknown", winning_votes, vote_ratio

    if vote_ratio < min_vote_ratio:
        return "unknown", winning_votes, vote_ratio

    predicted_organ = "fruit" if fruit_count > leaf_count else "leaf"
    return predicted_organ, winning_votes, vote_ratio


def run_organ_router(
    vector: np.ndarray,
    assets_dir: str | Path | None,
    top_k: int = 7,
    min_vote_ratio: float = 0.60,
    organ_index_path: str | Path | None = None,
    organ_metadata_path: str | Path | None = None,
) -> dict:
    query_vector = _prepare_query_vector(vector)
    paths = resolve_pipeline_paths(assets_dir)
    index_path = (
        resolve_path_from_assets(assets_dir, organ_index_path)
        if organ_index_path is not None
        else paths["organ_index"]
    )
    metadata_path = (
        resolve_path_from_assets(assets_dir, organ_metadata_path)
        if organ_metadata_path is not None
        else paths["organ_metadata"]
    )

    index, metadata = _load_index_and_metadata(
        index_path=index_path,
        metadata_path=metadata_path,
        required_columns={"organ", "label"},
        description="organ router",
    )
    scores, indices = _search_neighbors(index, metadata, query_vector, top_k, "organ router")

    neighbors = [
        _make_neighbor_record(metadata, neighbor_index, score, rank)
        for rank, (score, neighbor_index) in enumerate(zip(scores, indices), start=1)
    ]

    fruit_count = sum(1 for neighbor in neighbors if neighbor["organ"] == "fruit")
    leaf_count = sum(1 for neighbor in neighbors if neighbor["organ"] == "leaf")
    predicted_organ, winning_votes, vote_ratio = _decide_organ(
        fruit_count=fruit_count,
        leaf_count=leaf_count,
        total_votes=top_k,
        min_vote_ratio=min_vote_ratio,
    )

    return {
        "predicted_organ": predicted_organ,
        "vote": f"{winning_votes}/{top_k}",
        "winning_votes": winning_votes,
        "total_votes": top_k,
        "vote_ratio": vote_ratio,
        "top_organ_score": float(neighbors[0]["score"]),
        "fruit_count": fruit_count,
        "leaf_count": leaf_count,
        "metric": "cosine_similarity_indexflatip",
        "index_path": index_path,
        "metadata_path": metadata_path,
        "neighbors": neighbors,
    }


def run_disease_search(
    vector: np.ndarray,
    assets_dir: str | Path | None,
    organ: str,
    top_k: int = 5,
    index_path: str | Path | None = None,
    metadata_path: str | Path | None = None,
) -> dict:
    query_vector = _prepare_query_vector(vector)
    normalized_organ = organ.lower().strip()

    if (index_path is None) != (metadata_path is None):
        raise ValueError(
            "Custom disease search paths must provide both index_path and metadata_path together"
        )

    if index_path is None and metadata_path is None:
        resolved_index_path, resolved_metadata_path = select_disease_resources(
            assets_dir,
            normalized_organ,
        )
    else:
        resolved_index_path = resolve_path_from_assets(assets_dir, index_path)
        resolved_metadata_path = resolve_path_from_assets(assets_dir, metadata_path)

    index, metadata = _load_index_and_metadata(
        index_path=resolved_index_path,
        metadata_path=resolved_metadata_path,
        required_columns={"label", "organ"},
        description=f"{normalized_organ} disease search",
    )
    scores, indices = _search_neighbors(
        index,
        metadata,
        query_vector,
        top_k,
        f"{normalized_organ} disease search",
    )

    neighbors = [
        _make_neighbor_record(metadata, neighbor_index, score, rank)
        for rank, (score, neighbor_index) in enumerate(zip(scores, indices), start=1)
    ]

    top1_neighbor = neighbors[0]
    return {
        "organ": normalized_organ,
        "index_path": resolved_index_path,
        "metadata_path": resolved_metadata_path,
        "score_type": "cosine_similarity",
        "top_k": top_k,
        "top1_label": top1_neighbor["label"],
        "top1_score": top1_neighbor["score"],
        "neighbors": neighbors,
    }


def warm_up_vector_inference_assets(
    assets_dir: str | Path | None,
    *,
    organ_classifier_path: str | Path,
    labels_path: str | Path,
    fruit_index_path: str | Path,
    fruit_metadata_path: str | Path,
    leaf_index_path: str | Path,
    leaf_metadata_path: str | Path,
) -> None:
    LOGGER.info("Starting vector inference asset warm-up assets_dir=%s", assets_dir)
    warmup_started_at = time.perf_counter()

    resolved_classifier_path = resolve_path_from_assets(assets_dir, organ_classifier_path)
    resolved_labels_path = resolve_path_from_assets(assets_dir, labels_path)
    ensure_file_exists(resolved_classifier_path, "organ classifier model")
    ensure_file_exists(resolved_labels_path, "organ classifier labels")
    load_json_file(resolved_labels_path)
    _load_classifier_model(resolved_classifier_path)

    _load_index_and_metadata(
        index_path=resolve_path_from_assets(assets_dir, fruit_index_path),
        metadata_path=resolve_path_from_assets(assets_dir, fruit_metadata_path),
        required_columns={"label", "organ"},
        description="fruit disease search",
    )
    _load_index_and_metadata(
        index_path=resolve_path_from_assets(assets_dir, leaf_index_path),
        metadata_path=resolve_path_from_assets(assets_dir, leaf_metadata_path),
        required_columns={"label", "organ"},
        description="leaf disease search",
    )

    LOGGER.info(
        "Completed vector inference asset warm-up assets_dir=%s duration_seconds=%.3f",
        assets_dir,
        time.perf_counter() - warmup_started_at,
    )


def compute_retrieval_vote(disease_neighbors: list[dict]) -> dict:
    if not disease_neighbors:
        raise ValueError("disease_neighbors must not be empty")

    label_counts: dict[str, int] = {}
    label_score_sum: dict[str, float] = {}

    for neighbor in disease_neighbors:
        label = str(neighbor["label"])
        score = float(neighbor["score"])
        label_counts[label] = label_counts.get(label, 0) + 1
        label_score_sum[label] = label_score_sum.get(label, 0.0) + score

    label_score_average = {
        label: label_score_sum[label] / label_counts[label]
        for label in label_counts
    }

    ranked_by_majority = sorted(
        label_counts.keys(),
        key=lambda label: (
            label_counts[label],
            label_score_sum[label],
            label_score_average[label],
            label,
        ),
        reverse=True,
    )
    majority_label = ranked_by_majority[0]
    majority_count = label_counts[majority_label]
    majority_vote_total = len(disease_neighbors)
    majority_vote_ratio = majority_count / majority_vote_total

    weighted_label = max(
        label_score_sum.keys(),
        key=lambda label: (label_score_sum[label], label_counts[label], label),
    )

    ordered_label_score_sum = {
        label: float(label_score_sum[label])
        for label in sorted(
            label_score_sum.keys(),
            key=lambda label: (label_score_sum[label], label_counts[label], label),
            reverse=True,
        )
    }
    ordered_label_score_average = {
        label: float(label_score_average[label])
        for label in sorted(
            label_score_average.keys(),
            key=lambda label: (label_counts[label], label_score_average[label], label),
            reverse=True,
        )
    }

    return {
        "top1_label": str(disease_neighbors[0]["label"]),
        "top1_score": float(disease_neighbors[0]["score"]),
        "majority_label": majority_label,
        "majority_vote": f"{majority_count}/{majority_vote_total}",
        "majority_vote_count": majority_count,
        "majority_vote_total": majority_vote_total,
        "majority_vote_ratio": majority_vote_ratio,
        "weighted_label": weighted_label,
        "label_score_sum": ordered_label_score_sum,
        "label_score_average": ordered_label_score_average,
    }


def make_retrieval_decision(vote_result: dict, thresholds: dict | None) -> dict:
    merged_thresholds = DEFAULT_RETRIEVAL_THRESHOLDS.copy()
    if thresholds:
        merged_thresholds.update(thresholds)

    reasons: list[str] = []

    if vote_result["top1_score"] < merged_thresholds["min_top1_score"]:
        reasons.append(
            "top1 similarity score is below threshold "
            f"({vote_result['top1_score']:.4f} < {merged_thresholds['min_top1_score']:.4f})"
        )

    if vote_result["majority_vote_ratio"] < merged_thresholds["min_majority_vote_ratio"]:
        reasons.append(
            "majority vote ratio is below threshold "
            f"({vote_result['majority_vote_ratio']:.3f} < "
            f"{merged_thresholds['min_majority_vote_ratio']:.3f})"
        )

    if (
        merged_thresholds["require_top1_majority_match"]
        and vote_result["top1_label"] != vote_result["majority_label"]
    ):
        reasons.append(
            f"top1 label '{vote_result['top1_label']}' does not match majority label "
            f"'{vote_result['majority_label']}'"
        )

    if (
        merged_thresholds["require_majority_weighted_match"]
        and vote_result["majority_label"] != vote_result["weighted_label"]
    ):
        reasons.append(
            f"majority label '{vote_result['majority_label']}' does not match weighted label "
            f"'{vote_result['weighted_label']}'"
        )

    final_label = vote_result["majority_label"]
    if vote_result["majority_label"] != vote_result["weighted_label"]:
        final_label = vote_result["weighted_label"]

    if reasons:
        return {
            "decision": "UNCERTAIN",
            "final_label": final_label,
            "reasons": reasons,
            "recommended_action": "manual_review",
        }

    return {
        "decision": "CONFIDENT",
        "final_label": final_label,
        "reasons": ["top1, majority, and weighted retrieval signals are aligned"],
        "recommended_action": "accept",
    }
