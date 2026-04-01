#!/usr/bin/env python3
import argparse
import json
import pickle
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max_value, max(min_value, value))


def parse_date_safe(value: Any) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        text = str(value).strip()
        if text.endswith("Z"):
            text = text.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def get_hour_from_date_string(value: Any) -> int:
    if not value:
        return 12
    text = str(value)
    if "T" in text:
        text = text.split("T", 1)[1]
    elif " " in text:
        text = text.split(" ", 1)[1]
    hour = 12
    try:
        hour = int(text.split(":", 1)[0])
    except Exception:
        return 12
    return int(clamp(hour, 0, 23))


def format_hour_range(start_hour: int, duration: int = 4) -> str:
    start = int(clamp(start_hour, 0, 23))
    end = (start + duration) % 24
    return f"{start:02d}:00 - {end:02d}:00"


def to_feature_vector(record: Dict[str, Any], now: Optional[datetime] = None) -> List[float]:
    now = now or datetime.now(timezone.utc)
    event_date = parse_date_safe(record.get("registrationDate"))
    days_since_reported = (now - event_date).total_seconds() / 86400.0
    day_of_week = (event_date.weekday() + 1) % 7  # Align with JS getDay() convention.
    return [
        float(record.get("latitude") or 0.0),
        float(record.get("longitude") or 0.0),
        float(get_hour_from_date_string(record.get("registrationDate"))),
        float(day_of_week),
        float(event_date.month),
        float(clamp(float(record.get("incidentCount") or 1.0), 1.0, 200.0)),
        float(clamp(float(record.get("riskScore") or 50.0), 0.0, 100.0)),
        float(clamp(days_since_reported, 0.0, 3650.0)),
    ]


def normalize_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    date = parse_date_safe(raw.get("registrationDate") or raw.get("recorded_date"))
    return {
        "district": raw.get("district") or raw.get("zone_name") or "Unknown",
        "policeStation": raw.get("policeStation") or raw.get("zone_name") or raw.get("address") or "Unknown",
        "crimeType": raw.get("crimeType") or raw.get("crime_type") or "Unknown",
        "latitude": float(raw.get("latitude") or 0.0),
        "longitude": float(raw.get("longitude") or 0.0),
        "address": raw.get("address") or raw.get("zone_name") or "Unknown",
        "registrationDate": raw.get("registrationDate") or raw.get("recorded_date") or date.isoformat(),
        "incidentCount": float(raw.get("incidentCount") or raw.get("incident_count") or 1.0),
        "riskScore": float(raw.get("riskScore") or raw.get("risk_score") or 50.0),
    }


def predict_probabilities(artifact: Dict[str, Any], features: List[float]) -> List[Dict[str, Any]]:
    model = artifact["model"]
    classes = model.classes_
    probs = model.predict_proba([features])[0]
    items = [
        {"crimeType": str(classes[index]), "probability": float(probs[index] * 100.0)}
        for index in range(len(classes))
    ]
    items.sort(key=lambda item: item["probability"], reverse=True)
    return [
        {"crimeType": item["crimeType"], "probability": round(item["probability"], 1)}
        for item in items[:5]
    ]


def build_zone_summaries(records: List[Dict[str, Any]], artifact: Dict[str, Any], accuracy: float) -> List[Dict[str, Any]]:
    zone_map: Dict[str, Dict[str, Any]] = {}

    for record in records:
        zone_name = record.get("policeStation") or record.get("address") or "Unknown"
        key = str(zone_name).strip().lower()
        incident_weight = clamp(float(record.get("incidentCount") or 1.0), 1.0, 50.0)
        risk_score = clamp(float(record.get("riskScore") or 50.0), 0.0, 100.0)
        event_date = parse_date_safe(record.get("registrationDate"))
        hour = get_hour_from_date_string(record.get("registrationDate"))

        if key not in zone_map:
            zone_map[key] = {
                "zone": zone_name,
                "weightedLat": 0.0,
                "weightedLng": 0.0,
                "totalWeight": 0.0,
                "totalIncidents": 0.0,
                "weightedRisk": 0.0,
                "latestDate": event_date,
                "hourCounts": [0.0] * 24,
            }

        zone = zone_map[key]
        zone["weightedLat"] += float(record.get("latitude") or 0.0) * incident_weight
        zone["weightedLng"] += float(record.get("longitude") or 0.0) * incident_weight
        zone["totalWeight"] += incident_weight
        zone["totalIncidents"] += incident_weight
        zone["weightedRisk"] += risk_score * incident_weight
        zone["hourCounts"][hour] += incident_weight
        if event_date > zone["latestDate"]:
            zone["latestDate"] = event_date

    results: List[Dict[str, Any]] = []
    for zone in zone_map.values():
        latitude = zone["weightedLat"] / max(zone["totalWeight"], 1.0)
        longitude = zone["weightedLng"] / max(zone["totalWeight"], 1.0)
        avg_risk = zone["weightedRisk"] / max(zone["totalWeight"], 1.0)
        representative = {
            "latitude": latitude,
            "longitude": longitude,
            "incidentCount": max(1.0, round(zone["totalIncidents"] / 3.0)),
            "riskScore": avg_risk,
            "registrationDate": zone["latestDate"].isoformat(),
        }

        probabilities = predict_probabilities(artifact, to_feature_vector(representative))
        top = probabilities[0] if probabilities else {"crimeType": "Unknown", "probability": 0.0}
        predicted_crimes = max(1, round(zone["totalIncidents"] * (0.4 + avg_risk / 170.0)))
        risk_score = clamp(
            round(avg_risk * 0.55 + top["probability"] * 0.35 + min(zone["totalIncidents"], 45.0) * 0.5),
            20.0,
            100.0,
        )

        peak_hour = max(range(24), key=lambda hour: zone["hourCounts"][hour])
        confidence = clamp(round((accuracy * 0.65) + (top["probability"] * 0.35)), 45.0, 98.0)

        results.append(
            {
                "zone": zone["zone"],
                "latitude": latitude,
                "longitude": longitude,
                "totalIncidents": zone["totalIncidents"],
                "riskScore": int(risk_score),
                "predictedCrimes": int(predicted_crimes),
                "peakHours": format_hour_range(peak_hour),
                "confidence": int(confidence),
                "topCrimeType": top["crimeType"],
                "topCrimeProbability": float(top["probability"]),
                "crimeProbabilities": probabilities,
            }
        )

    results.sort(key=lambda item: item["riskScore"], reverse=True)
    return results


def build_trend_prediction(records: List[Dict[str, Any]], artifact: Dict[str, Any], accuracy: float) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    buckets: Dict[str, Dict[str, float]] = {}
    hourly = [0.0] * 24
    weekday = [{"day": day, "crimeCount": 0.0} for day in DAY_NAMES]

    for record in records:
        date = parse_date_safe(record.get("registrationDate"))
        days_ago = (now - date).total_seconds() / 86400.0
        if days_ago > 60:
            continue
        crime_type = record.get("crimeType") or "Unknown"
        weight = clamp(float(record.get("incidentCount") or 1.0), 1.0, 50.0)
        hour = get_hour_from_date_string(record.get("registrationDate"))
        if crime_type not in buckets:
            buckets[crime_type] = {"recent": 0.0, "previous": 0.0, "total": 0.0}
        if days_ago <= 30:
            buckets[crime_type]["recent"] += weight
        else:
            buckets[crime_type]["previous"] += weight
        buckets[crime_type]["total"] += weight
        hourly[hour] += weight
        weekday[(date.weekday() + 1) % 7]["crimeCount"] += weight

    sorted_items = sorted(buckets.items(), key=lambda kv: kv[1]["total"], reverse=True)[:8]
    trends: List[Dict[str, Any]] = []
    for crime_type, bucket in sorted_items:
        baseline = max(bucket["previous"], 1.0)
        percent_change = round(((bucket["recent"] - bucket["previous"]) / baseline) * 100.0, 1)
        direction = "stable"
        if percent_change > 12:
            direction = "increasing"
        elif percent_change < -12:
            direction = "decreasing"

        trends.append(
            {
                "crimeType": crime_type,
                "direction": direction,
                "percentChange": percent_change,
                "prediction": (
                    f"Likely rise in {crime_type} next week."
                    if direction == "increasing"
                    else f"Expected stabilization with lower {crime_type} incidence."
                    if direction == "decreasing"
                    else f"Pattern remains stable for {crime_type}."
                ),
            }
        )

    max_hourly = max(max(hourly), 1.0)
    return {
        "trends": trends,
        "hourlyDistribution": [
            {
                "hour": hour,
                "crimeCount": round(count),
                "riskLevel": "high" if count / max_hourly > 0.66 else "medium" if count / max_hourly > 0.33 else "low",
            }
            for hour, count in enumerate(hourly)
        ],
        "weeklyPattern": [{"day": item["day"], "crimeCount": round(item["crimeCount"])} for item in weekday],
        "modelAccuracy": round(accuracy, 1),
    }


def build_risk_prediction(zone_summaries: List[Dict[str, Any]], accuracy: float) -> Dict[str, Any]:
    risk_zones = []
    for zone in zone_summaries[:10]:
        score = zone["riskScore"]
        risk_zones.append(
            {
                "area": zone["zone"],
                "riskScore": score,
                "factors": [
                    f"Likely crime: {zone['topCrimeType']} ({zone['topCrimeProbability']:.1f}%)",
                    f"Historical incident weight: {round(zone['totalIncidents'])}",
                    f"Peak alert window: {zone['peakHours']}",
                ],
                "recommendation": (
                    "Deploy rapid response unit and increase CCTV monitoring."
                    if score >= 75
                    else "Increase patrol frequency and issue traveler alerts."
                    if score >= 60
                    else "Maintain routine patrol with targeted awareness."
                ),
            }
        )

    high_risk_count = sum(1 for zone in risk_zones if zone["riskScore"] >= 70)
    prevention_rate = clamp(round(accuracy * 0.75 + (100 - high_risk_count * 4) * 0.25), 55.0, 96.0)
    return {
        "riskZones": risk_zones,
        "overallAssessment": (
            f"{high_risk_count} zones need immediate preventive coverage based on Random Forest risk scoring."
            if high_risk_count > 0
            else "No critical zones detected; maintain preventive patrol coverage."
        ),
        "highRiskCount": int(high_risk_count),
        "preventionRate": int(prevention_rate),
        "modelAccuracy": round(accuracy, 1),
    }


def build_patrol_prediction(zone_summaries: List[Dict[str, Any]], accuracy: float) -> Dict[str, Any]:
    routes = []
    for index, zone in enumerate(zone_summaries[:8]):
        routes.append(
            {
                "priority": index + 1,
                "area": zone["zone"],
                "suggestedTime": zone["peakHours"],
                "crimeTypes": [entry["crimeType"] for entry in zone["crimeProbabilities"][:2]],
                "officersNeeded": int(clamp(round(zone["riskScore"] / 22.0), 2.0, 8.0)),
            }
        )
    return {
        "routes": routes,
        "coverageOptimization": "Prioritize overlapping high-risk corridors first, then expand patrol rings based on travel alert triggers.",
        "modelAccuracy": round(accuracy, 1),
    }


def get_overall_risk_level(score: float) -> str:
    if score >= 78:
        return "critical"
    if score >= 62:
        return "high"
    if score >= 42:
        return "medium"
    return "low"


def build_prediction(records: List[Dict[str, Any]], prediction_type: str, artifact: Dict[str, Any]) -> Dict[str, Any]:
    accuracy = float(artifact.get("accuracy", 0.0))
    zone_summaries = build_zone_summaries(records, artifact, accuracy)
    overall_risk = (
        sum(zone["riskScore"] for zone in zone_summaries) / max(len(zone_summaries), 1)
        if zone_summaries
        else 0.0
    )

    if prediction_type == "hotspot":
        hotspots = []
        for zone in zone_summaries[:10]:
            hotspots.append(
                {
                    "zone": zone["zone"],
                    "riskScore": zone["riskScore"],
                    "predictedCrimes": zone["predictedCrimes"],
                    "crimeTypes": [entry["crimeType"] for entry in zone["crimeProbabilities"][:3]],
                    "crimeTypeProbabilities": zone["crimeProbabilities"][:3],
                    "topCrimeType": zone["topCrimeType"],
                    "topCrimeProbability": zone["topCrimeProbability"],
                    "peakHours": zone["peakHours"],
                    "confidence": zone["confidence"],
                    "reasoning": (
                        f"{zone['topCrimeType']} has the strongest class probability "
                        f"({zone['topCrimeProbability']:.1f}%) in this zone."
                    ),
                }
            )

        return {
            "hotspots": hotspots,
            "overallRiskLevel": get_overall_risk_level(overall_risk),
            "modelAccuracy": round(accuracy, 1),
            "dataQuality": "good" if len(records) > 300 else "fair" if len(records) > 120 else "poor",
            "highRiskCount": sum(1 for zone in hotspots if zone["riskScore"] >= 70),
        }

    if prediction_type == "trend":
        return build_trend_prediction(records, artifact, accuracy)

    if prediction_type == "risk":
        return build_risk_prediction(zone_summaries, accuracy)

    return build_patrol_prediction(zone_summaries, accuracy)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run prediction using stored Random Forest .pkl model")
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--records-path", required=True)
    parser.add_argument("--prediction-type", choices=["hotspot", "trend", "risk", "patrol"], default="hotspot")
    parser.add_argument("--target-area", default=None)
    args = parser.parse_args()

    model_path = Path(args.model_path)
    records_path = Path(args.records_path)

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    artifact = pickle.loads(model_path.read_bytes())
    if not isinstance(artifact, dict) or "model" not in artifact:
        raise ValueError("Invalid model artifact format.")

    raw_records = json.loads(records_path.read_text(encoding="utf-8"))
    if not isinstance(raw_records, list):
        raise ValueError("records-path JSON must be an array.")

    records = [normalize_record(record) for record in raw_records]
    filtered = records
    if args.target_area:
        target = args.target_area.lower()
        filtered = [
            record
            for record in records
            if target in str(record.get("policeStation", "")).lower()
            or target in str(record.get("district", "")).lower()
        ]

    if len(filtered) < 10:
        raise ValueError("Not enough records for this area to run model prediction.")

    prediction = build_prediction(filtered, args.prediction_type, artifact)
    output = {
        "predictionType": args.prediction_type,
        "prediction": prediction,
        "dataPoints": len(filtered),
        "model": str(artifact.get("modelId", "random-forest-pkl-v1")),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        raise
