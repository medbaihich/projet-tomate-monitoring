from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np


SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from config import PROJECT_ROOT
from local_ai_pipeline_utils import (
    EXPECTED_FEATURE_DIM,
    NORM_ATOL,
    compute_retrieval_vote,
    l2_normalize,
    run_disease_search,
    run_organ_classifier,
    warm_up_vector_inference_assets,
)


DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA = 0.60
DEFAULT_TOP_K_DISEASE = 5
DEFAULT_FRUIT_INDEX_PATH = "indexes/fruit_faiss.index"
DEFAULT_FRUIT_METADATA_PATH = "metadata/fruit_metadata.csv"
DEFAULT_LEAF_INDEX_PATH = "indexes/leaf_faiss.index"
DEFAULT_LEAF_METADATA_PATH = "metadata/leaf_metadata.csv"
DEFAULT_ORGAN_CLASSIFIER_PATH = "models/organ_classifier_logreg.pkl"
DEFAULT_ORGAN_CLASSIFIER_LABELS = "models/organ_classifier_labels.json"
REQUIRED_PAYLOAD_FIELDS = {
    "device_id",
    "message_type",
    "image_id",
    "feature_dim",
    "l2_normalized",
    "feature_vector",
}


@dataclass(slots=True)
class InferenceConfig:
    assets_dir: str | Path = field(default_factory=lambda: str(PROJECT_ROOT))
    top_k_disease: int = DEFAULT_TOP_K_DISEASE
    min_organ_classifier_proba: float = DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA
    fruit_index_path: str | Path = DEFAULT_FRUIT_INDEX_PATH
    fruit_metadata_path: str | Path = DEFAULT_FRUIT_METADATA_PATH
    leaf_index_path: str | Path = DEFAULT_LEAF_INDEX_PATH
    leaf_metadata_path: str | Path = DEFAULT_LEAF_METADATA_PATH
    organ_classifier_path: str | Path = DEFAULT_ORGAN_CLASSIFIER_PATH
    organ_classifier_labels: str | Path = DEFAULT_ORGAN_CLASSIFIER_LABELS


def validate_payload(payload: dict) -> None:
    missing_fields = sorted(REQUIRED_PAYLOAD_FIELDS - set(payload.keys()))
    if missing_fields:
        raise ValueError(f"JSON payload is missing required fields: {missing_fields}")

    if not isinstance(payload["device_id"], str) or not payload["device_id"].strip():
        raise ValueError("device_id must be a non-empty string")
    if payload["message_type"] != "feature_vector":
        raise ValueError("message_type must be 'feature_vector'")
    if not isinstance(payload["image_id"], str) or not payload["image_id"].strip():
        raise ValueError("image_id must be a non-empty string")
    if not isinstance(payload["l2_normalized"], bool):
        raise ValueError("l2_normalized must be a boolean")
    if payload["feature_dim"] != EXPECTED_FEATURE_DIM:
        raise ValueError(
            f"feature_dim must be {EXPECTED_FEATURE_DIM}, got {payload['feature_dim']}"
        )


def _prepare_input_vector(vector_like) -> dict:
    vector = np.asarray(vector_like, dtype=np.float32)
    if vector.ndim == 2:
        if vector.shape != (1, EXPECTED_FEATURE_DIM):
            raise ValueError(
                f"feature_vector must have shape (1, {EXPECTED_FEATURE_DIM}), got {vector.shape}"
            )
        vector = vector[0]
    elif vector.ndim != 1:
        raise ValueError(f"feature_vector must be a 1D array, got shape {vector.shape}")

    if vector.shape[0] != EXPECTED_FEATURE_DIM:
        raise ValueError(
            f"feature_vector length must be {EXPECTED_FEATURE_DIM}, got {vector.shape[0]}"
        )
    if not np.isfinite(vector).all():
        raise ValueError("feature_vector contains NaN or Inf values")

    input_vector_norm = float(np.linalg.norm(vector))
    normalized_vector = vector.copy()
    warnings: list[str] = []
    was_normalized = np.isclose(input_vector_norm, 1.0, atol=NORM_ATOL)
    if not was_normalized:
        warnings.append(
            f"input vector norm is not close to 1.0 ({input_vector_norm:.6f}); "
            "using an L2-normalized copy for retrieval"
        )
        normalized_vector = l2_normalize(normalized_vector.reshape(1, -1))[0]

    normalized_vector_norm = float(np.linalg.norm(normalized_vector))
    return {
        "feature_vector": normalized_vector.astype(np.float32),
        "feature_dim": int(normalized_vector.shape[0]),
        "vector_norm": normalized_vector_norm,
        "input_vector_norm": input_vector_norm,
        "was_normalized": was_normalized,
        "warnings": warnings,
    }


def prepare_feature_vector(payload: dict) -> dict:
    validate_payload(payload)
    feature_result = _prepare_input_vector(payload["feature_vector"])
    if feature_result["feature_dim"] != int(payload["feature_dim"]):
        raise ValueError(
            "feature_vector length does not match feature_dim "
            f"({feature_result['feature_dim']} != {payload['feature_dim']})"
        )
    return feature_result


def _build_metadata(payload_metadata: Optional[dict] = None) -> dict:
    metadata = payload_metadata or {}
    return {
        "device_id": metadata.get("device_id", ""),
        "image_id": metadata.get("image_id", ""),
        "crop_id": metadata.get("crop_id", ""),
        "feature_model": metadata.get("feature_model", ""),
        "message_type": metadata.get("message_type", ""),
        "timestamp": metadata.get("timestamp", ""),
        "declared_vector_norm": metadata.get("vector_norm"),
        "l2_normalized": metadata.get("l2_normalized"),
    }


def _build_base_result(metadata: dict, feature_result: dict) -> dict:
    return {
        "device_id": metadata["device_id"],
        "image_id": metadata["image_id"],
        "crop_id": metadata["crop_id"],
        "feature_model": metadata["feature_model"],
        "message_type": metadata["message_type"],
        "timestamp": metadata["timestamp"],
        "declared_vector_norm": metadata["declared_vector_norm"],
        "l2_normalized": metadata["l2_normalized"],
        "feature_dim": feature_result["feature_dim"],
        "vector_norm": feature_result["vector_norm"],
        "input_vector_norm": feature_result["input_vector_norm"],
        "organ_type": "",
        "organ_confidence": None,
        "organ_status": "",
        "index_used": "",
        "metadata_used": "",
        "score_type": "",
        "top1_label": "",
        "top1_score": None,
        "majority_label": "",
        "final_label": "",
        "matches": [],
        "processing_status": "pending",
        "requires_review": False,
        "warnings": list(feature_result["warnings"]),
        "skip_reasons": [],
        "feature_result": feature_result,
        "classifier_result": None,
        "disease_result": None,
        "vote_result": None,
    }


def _run_inference(feature_result: dict, payload_metadata: Optional[dict], config: InferenceConfig) -> dict:
    metadata = _build_metadata(payload_metadata)
    result = _build_base_result(metadata, feature_result)

    classifier_result = run_organ_classifier(
        vector=feature_result["feature_vector"],
        assets_dir=config.assets_dir,
        classifier_path=config.organ_classifier_path,
        labels_path=config.organ_classifier_labels,
        min_probability=config.min_organ_classifier_proba,
    )
    predicted_organ = classifier_result["predicted_organ"]
    result["classifier_result"] = classifier_result
    result["organ_type"] = predicted_organ
    result["organ_confidence"] = float(classifier_result["organ_router_probability"])

    if predicted_organ == "unknown":
        result["organ_status"] = "unknown_below_threshold"
        result["processing_status"] = "skipped_unknown_organ"
        result["requires_review"] = True
        result["skip_reasons"] = [
            "organ classifier probability below threshold "
            f"({classifier_result['organ_router_probability']:.4f} < "
            f"{config.min_organ_classifier_proba:.4f})"
        ]
        return result

    disease_result = run_disease_search(
        vector=feature_result["feature_vector"],
        assets_dir=config.assets_dir,
        organ=predicted_organ,
        top_k=config.top_k_disease,
        index_path=(
            config.fruit_index_path if predicted_organ == "fruit" else config.leaf_index_path
        ),
        metadata_path=(
            config.fruit_metadata_path
            if predicted_organ == "fruit"
            else config.leaf_metadata_path
        ),
    )
    vote_result = compute_retrieval_vote(disease_result["neighbors"])
    requires_review = vote_result["top1_label"] != vote_result["majority_label"]

    result.update(
        {
            "organ_status": "routed",
            "index_used": disease_result["index_path"].name,
            "metadata_used": disease_result["metadata_path"].name,
            "score_type": disease_result["score_type"],
            "top1_label": vote_result["top1_label"],
            "top1_score": float(vote_result["top1_score"]),
            "majority_label": vote_result["majority_label"],
            "final_label": vote_result["top1_label"],
            "matches": disease_result["neighbors"],
            "processing_status": "processed",
            "requires_review": requires_review,
            "disease_result": disease_result,
            "vote_result": vote_result,
        }
    )
    return result


def run_inference_from_payload(
    payload: dict,
    config: Optional[InferenceConfig] = None,
) -> dict:
    active_config = InferenceConfig() if config is None else config
    feature_result = prepare_feature_vector(payload)
    return _run_inference(feature_result, payload, active_config)


def run_inference_from_vector(
    vector: np.ndarray,
    metadata: Optional[dict] = None,
    config: Optional[InferenceConfig] = None,
) -> dict:
    active_config = InferenceConfig() if config is None else config
    feature_result = _prepare_input_vector(vector)
    return _run_inference(feature_result, metadata, active_config)


def warm_up_inference_assets(config: Optional[InferenceConfig] = None) -> None:
    active_config = InferenceConfig() if config is None else config
    warm_up_vector_inference_assets(
        active_config.assets_dir,
        organ_classifier_path=active_config.organ_classifier_path,
        labels_path=active_config.organ_classifier_labels,
        fruit_index_path=active_config.fruit_index_path,
        fruit_metadata_path=active_config.fruit_metadata_path,
        leaf_index_path=active_config.leaf_index_path,
        leaf_metadata_path=active_config.leaf_metadata_path,
    )


__all__ = [
    "DEFAULT_FRUIT_INDEX_PATH",
    "DEFAULT_FRUIT_METADATA_PATH",
    "DEFAULT_LEAF_INDEX_PATH",
    "DEFAULT_LEAF_METADATA_PATH",
    "DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA",
    "DEFAULT_ORGAN_CLASSIFIER_LABELS",
    "DEFAULT_ORGAN_CLASSIFIER_PATH",
    "InferenceConfig",
    "REQUIRED_PAYLOAD_FIELDS",
    "prepare_feature_vector",
    "run_inference_from_payload",
    "run_inference_from_vector",
    "warm_up_inference_assets",
    "validate_payload",
]
