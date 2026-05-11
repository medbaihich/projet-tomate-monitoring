from collections import defaultdict
from hashlib import sha1

from django.core.exceptions import ValidationError
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from apps.inspections.disease_zone_profiles import (
    ZONE_POLICY_NO_ZONE,
    calculate_zone_radius_meters,
    get_disease_zone_profile,
    normalize_disease_key,
)
from apps.inspections.models import Inspection


HEALTHY_DISEASE_KEY = "healthy"
HIGH_SEVERITY_THRESHOLD = 0.85
RADIUS_REASON = "Estimated from disease profile, confidence, signal count, and recency."


def build_dashboard_map_signals(query_params):
    queryset = _base_queryset()
    queryset = _apply_filters(queryset, query_params)

    inspections = list(queryset)
    disease_options = _build_available_diseases(inspections)
    signal_candidates = [_inspection_to_signal_candidate(inspection) for inspection in inspections]
    mapped_signal_candidates = [
        signal for signal in signal_candidates if signal["has_valid_coordinates"]
    ]
    signals = [_signal_candidate_to_response(signal) for signal in mapped_signal_candidates]
    infection_zones = _build_infection_zones(mapped_signal_candidates)

    return {
        "filters": {
            "available_diseases": disease_options,
        },
        "signals": signals,
        "infection_zones": infection_zones,
        "summary": {
            "total_signals": len(signal_candidates),
            "mapped_signals": len(mapped_signal_candidates),
            "unmapped_signals": len(signal_candidates) - len(mapped_signal_candidates),
            "infection_zone_count": len(infection_zones),
        },
    }


def _base_queryset():
    return (
        Inspection.objects.select_related(
            "device",
            "device__line",
            "device__line__zone",
            "device__line__zone__greenhouse",
            "device__line__zone__greenhouse__site",
            "predicted_disease",
        )
        .filter(processing_status=Inspection.ProcessingStatus.COMPLETED)
        .order_by("-captured_at", "-created_at")
    )


def _apply_filters(queryset, query_params):
    queryset = queryset.filter(
        device__line__isnull=False,
        device__line__zone__isnull=False,
        device__line__zone__greenhouse__isnull=False,
        device__line__zone__greenhouse__site__isnull=False,
    )

    field_filters = {
        "site": "device__line__zone__greenhouse__site_id",
        "greenhouse": "device__line__zone__greenhouse_id",
        "zone": "device__line__zone_id",
        "line": "device__line_id",
        "device": "device_id",
        "organ_type": "organ_type",
    }
    for param_name, lookup in field_filters.items():
        value = query_params.get(param_name)
        if value:
            queryset = queryset.filter(**{lookup: value})

    disease_id = query_params.get("disease")
    if disease_id:
        queryset = queryset.filter(predicted_disease_id=disease_id)

    min_confidence = query_params.get("min_confidence")
    if min_confidence:
        try:
            min_confidence_value = float(min_confidence)
        except ValueError as exc:
            raise ValidationError({"min_confidence": "Must be a number between 0 and 1."}) from exc
        if min_confidence_value < 0 or min_confidence_value > 1:
            raise ValidationError({"min_confidence": "Must be a number between 0 and 1."})
        queryset = queryset.filter(confidence_score__gte=min_confidence_value)

    severity = query_params.get("severity")
    if severity:
        if severity == "high":
            queryset = queryset.filter(confidence_score__gte=HIGH_SEVERITY_THRESHOLD)
        elif severity == "medium":
            queryset = queryset.exclude(confidence_score__gte=HIGH_SEVERITY_THRESHOLD)
        else:
            raise ValidationError({"severity": "Must be either high or medium."})

    captured_after = _parse_datetime_param(query_params.get("captured_after"), "captured_after")
    if captured_after:
        queryset = queryset.filter(captured_at__gte=captured_after)

    captured_before = _parse_datetime_param(query_params.get("captured_before"), "captured_before")
    if captured_before:
        queryset = queryset.filter(captured_at__lte=captured_before)

    disease_name = query_params.get("disease_name")
    if disease_name:
        requested_key = normalize_disease_key(disease_name)
        matching_profile = get_disease_zone_profile(requested_key)
        allowed_keys = {requested_key}
        if matching_profile is not None:
            allowed_keys.add(matching_profile.key)
            allowed_keys.update(normalize_disease_key(alias) for alias in matching_profile.aliases)
            allowed_keys.add(normalize_disease_key(matching_profile.display_name))

        inspection_ids = [
            inspection.id
            for inspection in queryset
            if _resolve_profile(inspection) is not None
            and _resolve_disease_key(inspection) in allowed_keys
        ]
        queryset = queryset.filter(id__in=inspection_ids)

    disease_positive_ids = [
        inspection.id
        for inspection in queryset
        if _is_disease_positive(inspection)
    ]
    return queryset.filter(id__in=disease_positive_ids)


def _parse_datetime_param(value, field_name):
    if not value:
        return None

    parsed_value = parse_datetime(value)
    if parsed_value is None:
        raise ValidationError({field_name: "Must be a valid ISO 8601 datetime."})

    if timezone.is_naive(parsed_value):
        return timezone.make_aware(parsed_value, timezone.get_current_timezone())

    return parsed_value


def _is_disease_positive(inspection):
    disease_key = _resolve_disease_key(inspection)
    return bool(disease_key and disease_key != HEALTHY_DISEASE_KEY)


def _resolve_display_label(inspection):
    if inspection.predicted_disease is not None:
        return inspection.predicted_disease.name

    return (inspection.top1_label or "").strip()


def _resolve_profile(inspection):
    if inspection.predicted_disease is not None:
        profile = get_disease_zone_profile(
            inspection.predicted_disease.slug,
            inspection.organ_type,
        )
        if profile is not None:
            return profile

        return get_disease_zone_profile(
            inspection.predicted_disease.name,
            inspection.organ_type,
        )

    return get_disease_zone_profile(inspection.top1_label, inspection.organ_type)


def _resolve_disease_key(inspection):
    profile = _resolve_profile(inspection)
    if profile is not None:
        return profile.key

    if inspection.predicted_disease is not None:
        return normalize_disease_key(inspection.predicted_disease.slug or inspection.predicted_disease.name)

    return normalize_disease_key(inspection.top1_label)


def _build_available_diseases(inspections):
    disease_counts = defaultdict(int)
    disease_records = {}

    for inspection in inspections:
        disease_key = _resolve_disease_key(inspection)
        if not disease_key or disease_key == HEALTHY_DISEASE_KEY:
            continue

        profile = _resolve_profile(inspection)
        disease_id = str(inspection.predicted_disease_id) if inspection.predicted_disease_id else ""
        disease_counts[disease_key] += 1
        disease_records.setdefault(
            disease_key,
            {
                "id": disease_id,
                "key": disease_key,
                "name": _resolve_display_label(inspection) or disease_key,
                "zone_policy": profile.zone_policy if profile else ZONE_POLICY_NO_ZONE,
            },
        )

    return [
        {
            **disease_records[disease_key],
            "count": disease_counts[disease_key],
        }
        for disease_key in sorted(disease_records, key=lambda key: disease_records[key]["name"])
    ]


def _inspection_to_signal_candidate(inspection):
    device = inspection.device
    line = device.line
    zone = line.zone
    greenhouse = zone.greenhouse
    site = greenhouse.site
    latitude = _to_valid_latitude(device.latitude)
    longitude = _to_valid_longitude(device.longitude)
    profile = _resolve_profile(inspection)
    disease_key = _resolve_disease_key(inspection)
    disease_name = _resolve_display_label(inspection)

    return {
        "inspection": inspection,
        "profile": profile,
        "disease_key": disease_key,
        "disease_name": disease_name,
        "latitude": latitude,
        "longitude": longitude,
        "has_valid_coordinates": latitude is not None and longitude is not None,
        "device": device,
        "line": line,
        "zone": zone,
        "greenhouse": greenhouse,
        "site": site,
    }


def _signal_candidate_to_response(signal):
    inspection = signal["inspection"]
    profile = signal["profile"]
    device = signal["device"]
    line = signal["line"]
    zone = signal["zone"]
    greenhouse = signal["greenhouse"]
    site = signal["site"]

    return {
        "inspection_id": str(inspection.id),
        "device_id": str(device.id),
        "device_name": device.name,
        "identifier": device.identifier,
        "latitude": signal["latitude"],
        "longitude": signal["longitude"],
        "disease_id": str(inspection.predicted_disease_id) if inspection.predicted_disease_id else None,
        "disease_key": signal["disease_key"],
        "disease_name": signal["disease_name"],
        "label": signal["disease_name"] or inspection.top1_label,
        "confidence": inspection.confidence_score,
        "severity": _resolve_severity(inspection.confidence_score),
        "organ_type": inspection.organ_type,
        "captured_at": inspection.captured_at.isoformat() if inspection.captured_at else None,
        "source_message_id": inspection.source_message_id,
        "spread_type": profile.spread_type if profile else None,
        "zone_policy": profile.zone_policy if profile else ZONE_POLICY_NO_ZONE,
        "site_id": str(site.id),
        "site_name": site.name,
        "greenhouse_id": str(greenhouse.id),
        "greenhouse_name": greenhouse.name,
        "zone_id": str(zone.id),
        "zone_name": zone.name,
        "line_id": str(line.id),
        "line_name": line.name,
    }


def _build_infection_zones(signals):
    groups = defaultdict(list)
    for signal in signals:
        profile = signal["profile"]
        if profile is None or not profile.creates_zone:
            continue

        group_key = (
            signal["disease_key"],
            signal["site"].id,
            signal["greenhouse"].id,
            signal["zone"].id,
            signal["line"].id,
        )
        groups[group_key].append(signal)

    zones = []
    for group_key, group_signals in groups.items():
        profile = group_signals[0]["profile"]
        max_confidence = max(
            (signal["inspection"].confidence_score or 0 for signal in group_signals),
            default=0,
        )
        latest_captured_at = max(signal["inspection"].captured_at for signal in group_signals)
        radius_meters = calculate_zone_radius_meters(
            profile,
            confidence_score=max_confidence,
            signal_count=len(group_signals),
            latest_signal_at=latest_captured_at,
        )
        if radius_meters <= 0:
            continue

        latitude = sum(signal["latitude"] for signal in group_signals) / len(group_signals)
        longitude = sum(signal["longitude"] for signal in group_signals) / len(group_signals)
        first_signal = group_signals[0]
        first_inspection = first_signal["inspection"]
        zone_id = _build_stable_zone_id(group_key)

        zones.append(
            {
                "id": zone_id,
                "disease_id": (
                    str(first_inspection.predicted_disease_id)
                    if first_inspection.predicted_disease_id
                    else None
                ),
                "disease_key": first_signal["disease_key"],
                "disease_name": first_signal["disease_name"],
                "severity": _resolve_severity(max_confidence),
                "spread_type": profile.spread_type,
                "zone_policy": profile.zone_policy,
                "evidence_level": profile.evidence_level,
                "center": {
                    "latitude": round(latitude, 6),
                    "longitude": round(longitude, 6),
                },
                "radius_meters": radius_meters,
                "radius_reason": RADIUS_REASON,
                "signal_count": len(group_signals),
                "max_confidence": max_confidence,
                "latest_captured_at": latest_captured_at.isoformat() if latest_captured_at else None,
                "site_name": first_signal["site"].name,
                "greenhouse_name": first_signal["greenhouse"].name,
                "zone_name": first_signal["zone"].name,
                "line_name": first_signal["line"].name,
            }
        )

    return sorted(zones, key=lambda zone: (zone["disease_name"], zone["line_name"]))


def _build_stable_zone_id(group_key):
    raw_key = ":".join(str(value) for value in group_key)
    return f"zone-{sha1(raw_key.encode('utf-8')).hexdigest()[:16]}"


def _resolve_severity(confidence_score):
    if confidence_score is not None and confidence_score >= HIGH_SEVERITY_THRESHOLD:
        return "high"

    return "medium"


def _to_valid_latitude(value):
    if value is None or value < -90 or value > 90:
        return None

    return value


def _to_valid_longitude(value):
    if value is None or value < -180 or value > 180:
        return None

    return value
