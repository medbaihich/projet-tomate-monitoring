from dataclasses import dataclass
from datetime import timedelta
import re

from django.utils import timezone


SPREAD_TYPE_NON_INFECTIOUS = "non_infectious"
SPREAD_TYPE_SPLASH_LOCAL = "splash_local"
SPREAD_TYPE_AIRBORNE = "airborne"
SPREAD_TYPE_VECTOR_BORNE = "vector_borne"
SPREAD_TYPE_SOIL_WATER = "soil_water"
SPREAD_TYPE_UNKNOWN = "unknown"

ZONE_POLICY_NO_ZONE = "no_zone"
ZONE_POLICY_LOCAL_RISK_ZONE = "local_risk_zone"
ZONE_POLICY_EXPANDED_RISK_ZONE = "expanded_risk_zone"
ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE = "vector_surveillance_zone"
ZONE_POLICY_CONSERVATIVE_WATCH_ZONE = "conservative_watch_zone"

ALLOWED_SPREAD_TYPES = {
    SPREAD_TYPE_NON_INFECTIOUS,
    SPREAD_TYPE_SPLASH_LOCAL,
    SPREAD_TYPE_AIRBORNE,
    SPREAD_TYPE_VECTOR_BORNE,
    SPREAD_TYPE_SOIL_WATER,
    SPREAD_TYPE_UNKNOWN,
}

ALLOWED_ZONE_POLICIES = {
    ZONE_POLICY_NO_ZONE,
    ZONE_POLICY_LOCAL_RISK_ZONE,
    ZONE_POLICY_EXPANDED_RISK_ZONE,
    ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE,
    ZONE_POLICY_CONSERVATIVE_WATCH_ZONE,
}


@dataclass(frozen=True)
class DiseaseZoneProfile:
    key: str
    aliases: tuple[str, ...]
    display_name: str
    organ_types: tuple[str, ...]
    spread_type: str
    zone_policy: str
    base_radius_meters: float
    max_radius_meters: float
    confidence_weight: float
    signal_count_weight: float
    recency_weight: float
    rationale: str
    evidence_level: str

    @property
    def creates_zone(self) -> bool:
        return (
            self.zone_policy != ZONE_POLICY_NO_ZONE
            and self.base_radius_meters > 0
            and self.max_radius_meters > 0
        )


# These profiles are deterministic dashboard visualization defaults. They are
# approximate operational risk estimates, not exact biological spread distances,
# and should be calibrated with agronomic expertise before production decisions.
DISEASE_ZONE_PROFILES = {
    "anthracnose": DiseaseZoneProfile(
        key="anthracnose",
        aliases=("anthracnose", "fruit anthracnose"),
        display_name="Anthracnose",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_SPLASH_LOCAL,
        zone_policy=ZONE_POLICY_LOCAL_RISK_ZONE,
        base_radius_meters=20,
        max_radius_meters=80,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Local fungal-risk estimate for nearby fruit and canopy surfaces where splash or contact spread may matter.",
        evidence_level="medium",
    ),
    "bacterial_spot": DiseaseZoneProfile(
        key="bacterial_spot",
        aliases=("bacterial_spot", "bacterial spot", "fruit bacterial spot"),
        display_name="Bacterial Spot",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_SPLASH_LOCAL,
        zone_policy=ZONE_POLICY_LOCAL_RISK_ZONE,
        base_radius_meters=25,
        max_radius_meters=90,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Local bacterial-risk estimate for nearby plants because splash, handling, and short-distance movement can cluster symptoms.",
        evidence_level="medium",
    ),
    "blossom_end_rot": DiseaseZoneProfile(
        key="blossom_end_rot",
        aliases=("blossom_end_rot", "blossom end rot"),
        display_name="Blossom End Rot",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_NON_INFECTIOUS,
        zone_policy=ZONE_POLICY_NO_ZONE,
        base_radius_meters=0,
        max_radius_meters=0,
        confidence_weight=0.0,
        signal_count_weight=0.0,
        recency_weight=0.0,
        rationale="Physiological/quality disorder signal only; it should not create an infection zone.",
        evidence_level="high",
    ),
    "catfaced": DiseaseZoneProfile(
        key="catfaced",
        aliases=("catfaced", "catface", "catfacing"),
        display_name="Catfaced",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_NON_INFECTIOUS,
        zone_policy=ZONE_POLICY_NO_ZONE,
        base_radius_meters=0,
        max_radius_meters=0,
        confidence_weight=0.0,
        signal_count_weight=0.0,
        recency_weight=0.0,
        rationale="Fruit quality/development disorder signal only; it should not create an infection zone.",
        evidence_level="medium",
    ),
    "fruit_cracking": DiseaseZoneProfile(
        key="fruit_cracking",
        aliases=("fruit_cracking", "fruit cracking", "cracking"),
        display_name="Fruit Cracking",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_NON_INFECTIOUS,
        zone_policy=ZONE_POLICY_NO_ZONE,
        base_radius_meters=0,
        max_radius_meters=0,
        confidence_weight=0.0,
        signal_count_weight=0.0,
        recency_weight=0.0,
        rationale="Fruit quality/physiological signal only; it should not create an infection zone.",
        evidence_level="medium",
    ),
    "healthy": DiseaseZoneProfile(
        key="healthy",
        aliases=("healthy", "no disease", "normal"),
        display_name="Healthy",
        organ_types=("fruit", "leaf"),
        spread_type=SPREAD_TYPE_NON_INFECTIOUS,
        zone_policy=ZONE_POLICY_NO_ZONE,
        base_radius_meters=0,
        max_radius_meters=0,
        confidence_weight=0.0,
        signal_count_weight=0.0,
        recency_weight=0.0,
        rationale="Healthy detections are non-disease signals and must not create infection zones.",
        evidence_level="not_applicable",
    ),
    "late_blight": DiseaseZoneProfile(
        key="late_blight",
        aliases=("late_blight", "late blight", "fruit late blight", "leaf late blight"),
        display_name="Late Blight",
        organ_types=("fruit", "leaf"),
        spread_type=SPREAD_TYPE_AIRBORNE,
        zone_policy=ZONE_POLICY_EXPANDED_RISK_ZONE,
        base_radius_meters=60,
        max_radius_meters=200,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Expanded operational risk estimate because late blight can spread rapidly and by wind; radius is capped for local dashboard visualization.",
        evidence_level="medium",
    ),
    "mold": DiseaseZoneProfile(
        key="mold",
        aliases=("mold", "fruit mold", "generic mold"),
        display_name="Mold",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_UNKNOWN,
        zone_policy=ZONE_POLICY_CONSERVATIVE_WATCH_ZONE,
        base_radius_meters=15,
        max_radius_meters=60,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Generic mold label is ambiguous, so it uses a conservative local fungal-risk watch zone until calibrated.",
        evidence_level="low",
    ),
    "spotted_wilt_virus": DiseaseZoneProfile(
        key="spotted_wilt_virus",
        aliases=("spotted_wilt_virus", "spotted wilt virus", "tomato spotted wilt virus", "tswv"),
        display_name="Spotted Wilt Virus",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_VECTOR_BORNE,
        zone_policy=ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE,
        base_radius_meters=40,
        max_radius_meters=150,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Vector-mediated risk estimate for surveillance around the signal rather than a splash/contact infection zone.",
        evidence_level="medium",
    ),
    "target_spot": DiseaseZoneProfile(
        key="target_spot",
        aliases=("target_spot", "target spot", "fruit target spot"),
        display_name="Target Spot",
        organ_types=("fruit",),
        spread_type=SPREAD_TYPE_SPLASH_LOCAL,
        zone_policy=ZONE_POLICY_LOCAL_RISK_ZONE,
        base_radius_meters=25,
        max_radius_meters=100,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Local fungal-risk estimate for nearby plants where short-distance spread may cluster symptoms.",
        evidence_level="low_to_medium",
    ),
    "bushy_stunt": DiseaseZoneProfile(
        key="bushy_stunt",
        aliases=("bushy_stunt", "bushy stunt", "tomato bushy stunt"),
        display_name="Bushy Stunt",
        organ_types=("leaf",),
        spread_type=SPREAD_TYPE_SOIL_WATER,
        zone_policy=ZONE_POLICY_CONSERVATIVE_WATCH_ZONE,
        base_radius_meters=20,
        max_radius_meters=80,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Cautious operational watch zone for a soil/water/mechanical or uncertain virus signal; calibration is required.",
        evidence_level="needs_calibration",
    ),
    "early_blight": DiseaseZoneProfile(
        key="early_blight",
        aliases=("early_blight", "early blight", "leaf early blight"),
        display_name="Early Blight",
        organ_types=("leaf",),
        spread_type=SPREAD_TYPE_SPLASH_LOCAL,
        zone_policy=ZONE_POLICY_LOCAL_RISK_ZONE,
        base_radius_meters=25,
        max_radius_meters=100,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Local fungal-risk estimate for nearby leaves and plants because splash and short-distance movement can cluster disease signals.",
        evidence_level="medium",
    ),
    "leaf_curl": DiseaseZoneProfile(
        key="leaf_curl",
        aliases=("leaf_curl", "leaf curl", "tomato leaf curl", "tomato leaf curl virus"),
        display_name="Leaf Curl",
        organ_types=("leaf",),
        spread_type=SPREAD_TYPE_VECTOR_BORNE,
        zone_policy=ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE,
        base_radius_meters=40,
        max_radius_meters=150,
        confidence_weight=1.0,
        signal_count_weight=1.0,
        recency_weight=1.0,
        rationale="Vector-mediated risk estimate for surveillance around the signal rather than a splash/contact infection zone.",
        evidence_level="medium",
    ),
}


def _validate_profiles():
    for key, profile in DISEASE_ZONE_PROFILES.items():
        if key != profile.key:
            raise ValueError(f"Disease zone profile key mismatch: {key} != {profile.key}")
        if profile.spread_type not in ALLOWED_SPREAD_TYPES:
            raise ValueError(f"Unsupported spread_type for {key}: {profile.spread_type}")
        if profile.zone_policy not in ALLOWED_ZONE_POLICIES:
            raise ValueError(f"Unsupported zone_policy for {key}: {profile.zone_policy}")
        if profile.base_radius_meters < 0 or profile.max_radius_meters < 0:
            raise ValueError(f"Radius values must be non-negative for {key}")
        if profile.base_radius_meters > profile.max_radius_meters:
            raise ValueError(f"Base radius cannot exceed max radius for {key}")


def normalize_disease_key(value):
    if value is None:
        return ""

    normalized = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower())
    return normalized.strip("_")


def _build_alias_index():
    alias_index = {}

    for key, profile in DISEASE_ZONE_PROFILES.items():
        alias_index[normalize_disease_key(key)] = key
        alias_index[normalize_disease_key(profile.display_name)] = key
        for alias in profile.aliases:
            alias_index[normalize_disease_key(alias)] = key

    return alias_index


_validate_profiles()
DISEASE_ZONE_PROFILE_ALIASES = _build_alias_index()


def get_disease_zone_profile(value, organ_type=None):
    profile_key = DISEASE_ZONE_PROFILE_ALIASES.get(normalize_disease_key(value))
    if not profile_key:
        return None

    profile = DISEASE_ZONE_PROFILES[profile_key]
    if organ_type and organ_type not in profile.organ_types:
        return None

    return profile


def should_create_zone(profile, *, has_valid_coordinates=True):
    if profile is None or not has_valid_coordinates:
        return False

    return profile.creates_zone


def _weighted_multiplier(raw_multiplier, weight):
    return 1 + ((raw_multiplier - 1) * weight)


def get_confidence_multiplier(confidence_score, *, weight=1.0):
    if confidence_score is not None and confidence_score >= 0.85:
        raw_multiplier = 1.25
    elif confidence_score is not None and confidence_score >= 0.70:
        raw_multiplier = 1.10
    else:
        raw_multiplier = 1.00

    return _weighted_multiplier(raw_multiplier, weight)


def get_signal_count_multiplier(signal_count, *, weight=1.0):
    safe_signal_count = max(int(signal_count or 1), 1)
    raw_multiplier = 1 + min(safe_signal_count - 1, 4) * 0.15
    return _weighted_multiplier(raw_multiplier, weight)


def get_recency_multiplier(latest_signal_at, *, now=None, weight=1.0):
    if latest_signal_at is None:
        raw_multiplier = 1.00
    else:
        active_now = now or timezone.now()
        signal_at = latest_signal_at

        if timezone.is_naive(signal_at):
            signal_at = timezone.make_aware(signal_at, timezone.get_current_timezone())

        age = active_now - signal_at
        if age <= timedelta(hours=24):
            raw_multiplier = 1.15
        elif age <= timedelta(days=7):
            raw_multiplier = 1.00
        else:
            raw_multiplier = 0.85

    return _weighted_multiplier(raw_multiplier, weight)


def calculate_zone_radius_meters(
    profile,
    *,
    confidence_score=None,
    signal_count=1,
    latest_signal_at=None,
    now=None,
    has_valid_coordinates=True,
):
    if isinstance(profile, str):
        profile = get_disease_zone_profile(profile)

    if not should_create_zone(profile, has_valid_coordinates=has_valid_coordinates):
        return 0

    confidence_multiplier = get_confidence_multiplier(
        confidence_score,
        weight=profile.confidence_weight,
    )
    signal_count_multiplier = get_signal_count_multiplier(
        signal_count,
        weight=profile.signal_count_weight,
    )
    recency_multiplier = get_recency_multiplier(
        latest_signal_at,
        now=now,
        weight=profile.recency_weight,
    )
    radius = (
        profile.base_radius_meters
        * confidence_multiplier
        * signal_count_multiplier
        * recency_multiplier
    )

    return round(min(radius, profile.max_radius_meters), 2)
