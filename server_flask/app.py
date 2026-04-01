import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from bson import ObjectId
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import DESCENDING, MongoClient
from pymongo.collection import Collection


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


STATUS_LABELS = {
    "pending": "Pending",
    "in_progress": "In Progress",
    "in progress": "In Progress",
    "resolved": "Resolved",
    "rejected": "Rejected",
}


def normalize_status(value: Any) -> str:
    normalized = str(value or "pending").strip().lower()
    return STATUS_LABELS.get(normalized, "Pending")


def parse_created_at(value: Any, fallback_id: Any) -> Optional[str]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

    if isinstance(value, str) and value.strip():
        return value.strip()

    if isinstance(fallback_id, ObjectId):
        return fallback_id.generation_time.astimezone(timezone.utc).isoformat()

    return None


def to_complaint_response(document: Dict[str, Any]) -> Dict[str, Any]:
    complaint_id = document.get("complaint_id") or document.get("_id")
    file_url = document.get("file_url")

    return {
        "complaint_id": str(complaint_id),
        "title": str(document.get("title") or document.get("complaint_type") or "Untitled Complaint"),
        "description": str(document.get("description") or ""),
        "status": normalize_status(document.get("status")),
        "created_at": parse_created_at(document.get("created_at"), document.get("_id")),
        "file_url": str(file_url) if file_url else None,
    }


def build_user_query(user_id: str) -> Dict[str, Any]:
    queries = [{"user_id": user_id}]

    if ObjectId.is_valid(user_id):
        queries.append({"user_id": ObjectId(user_id)})

    return {"$or": queries}


def get_collection() -> Collection:
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongo_db_name = os.getenv("MONGO_DB_NAME", "city_guardian")
    complaints_collection_name = os.getenv("MONGO_COMPLAINTS_COLLECTION", "complaints")

    mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    database = mongo_client[mongo_db_name]
    return database[complaints_collection_name]


def create_app() -> Flask:
    app = Flask(__name__)

    cors_origin = os.getenv("CORS_ORIGIN", "*")
    allowed_origins = [origin.strip() for origin in cors_origin.split(",") if origin.strip()]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins or "*"}})

    complaints_collection = get_collection()

    @app.get("/health")
    def health_check():
        return jsonify({"status": "ok"})

    @app.get("/api/complaints/user/<user_id>")
    def get_user_complaints(user_id: str):
        normalized_user_id = user_id.strip()
        if not normalized_user_id:
            return jsonify({"error": "User ID is required."}), 400

        try:
            cursor = complaints_collection.find(build_user_query(normalized_user_id)).sort("created_at", DESCENDING)
            complaints = [to_complaint_response(document) for document in cursor]
            return jsonify({"complaints": complaints}), 200
        except Exception as error:
            app.logger.exception("Failed to fetch complaints: %s", error)
            return jsonify({"error": "Failed to fetch complaints."}), 500

    return app


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5001"))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
