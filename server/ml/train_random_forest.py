#!/usr/bin/env python3
import argparse
import json
import pickle
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split


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


def to_feature_vector(record: Dict[str, Any], now: datetime) -> List[float]:
    event_date = parse_date_safe(record.get("registrationDate"))
    days_since_reported = (now - event_date).total_seconds() / 86400.0
    return [
        float(record.get("latitude") or 0.0),
        float(record.get("longitude") or 0.0),
        float(get_hour_from_date_string(record.get("registrationDate"))),
        float(event_date.weekday() + 1) % 7,  # JS getDay: Sunday=0
        float(event_date.month),
        float(clamp(float(record.get("incidentCount") or 1.0), 1.0, 200.0)),
        float(clamp(float(record.get("riskScore") or 50.0), 0.0, 100.0)),
        float(clamp(days_since_reported, 0.0, 3650.0)),
    ]


def build_rows(records: List[Dict[str, Any]]) -> Tuple[List[List[float]], List[str], List[float]]:
    now = datetime.now(timezone.utc)
    features: List[List[float]] = []
    labels: List[str] = []
    weights: List[float] = []

    for record in records:
        lat = record.get("latitude")
        lng = record.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            lat = float(lat)
            lng = float(lng)
        except Exception:
            continue

        row = dict(record)
        row["latitude"] = lat
        row["longitude"] = lng
        features.append(to_feature_vector(row, now))
        labels.append(str(record.get("crimeType") or "Unknown"))
        weights.append(float(clamp(float(record.get("incidentCount") or 1.0), 1.0, 30.0)))

    return features, labels, weights


def train_model(
    records: List[Dict[str, Any]],
    n_estimators: int,
    max_depth: int,
    min_samples_leaf: int,
    random_state: int,
) -> Dict[str, Any]:
    features, labels, weights = build_rows(records)
    if len(features) < 10:
        raise ValueError("Not enough records to train Random Forest model (need at least 10).")

    classifier = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        random_state=random_state,
        n_jobs=-1,
    )

    accuracy = 0.0
    # Keep a holdout when there is enough class diversity and size.
    unique_labels = set(labels)
    if len(features) >= 40 and len(unique_labels) > 1:
        try:
            x_train, x_test, y_train, y_test, w_train, _w_test = train_test_split(
                features,
                labels,
                weights,
                test_size=0.2,
                random_state=random_state,
                stratify=labels if len(unique_labels) > 1 else None,
            )
            classifier.fit(x_train, y_train, sample_weight=w_train)
            accuracy = float(classifier.score(x_test, y_test) * 100.0)
        except Exception:
            classifier.fit(features, labels, sample_weight=weights)
            accuracy = float(classifier.score(features, labels) * 100.0)
    else:
        classifier.fit(features, labels, sample_weight=weights)
        accuracy = float(classifier.score(features, labels) * 100.0)

    trained_at = datetime.now(timezone.utc).isoformat()
    artifact: Dict[str, Any] = {
        "model": classifier,
        "featureNames": [
            "latitude",
            "longitude",
            "hourOfDay",
            "dayOfWeek",
            "month",
            "incidentCount",
            "riskScore",
            "daysSinceReported",
        ],
        "trainedAt": trained_at,
        "accuracy": round(accuracy, 2),
        "modelId": "random-forest-pkl-v1",
    }

    metadata = {
        "modelId": artifact["modelId"],
        "trainedAt": trained_at,
        "accuracy": round(accuracy, 2),
        "nEstimators": n_estimators,
        "maxDepth": max_depth,
        "minSamplesLeaf": min_samples_leaf,
        "recordsUsed": len(features),
        "classes": list(classifier.classes_),
    }

    return {"artifact": artifact, "metadata": metadata}


def main() -> int:
    parser = argparse.ArgumentParser(description="Train Random Forest model and persist as .pkl")
    parser.add_argument("--records-path", required=True, help="Path to JSON file containing training records array")
    parser.add_argument("--model-path", required=True, help="Output path for .pkl model")
    parser.add_argument("--metadata-path", required=True, help="Output path for metadata JSON")
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--max-depth", type=int, default=10)
    parser.add_argument("--min-samples-leaf", type=int, default=1)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    records_path = Path(args.records_path)
    model_path = Path(args.model_path)
    metadata_path = Path(args.metadata_path)

    records = json.loads(records_path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("records-path JSON must be an array.")

    result = train_model(
        records=records,
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        min_samples_leaf=args.min_samples_leaf,
        random_state=args.random_state,
    )

    model_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    with model_path.open("wb") as fp:
        pickle.dump(result["artifact"], fp)
    metadata_path.write_text(json.dumps(result["metadata"], indent=2), encoding="utf-8")

    print(json.dumps({"ok": True, **result["metadata"]}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        raise
