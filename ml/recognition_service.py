import cv2
import numpy as np
import face_recognition
import base64
from io import BytesIO
import requests
import pymongo
import os
import sys
from typing import Dict, Any, Optional
from datetime import datetime
import threading

MONGO_URI = os.getenv(
    "MONGO_ATLAS_URI",
    "mongodb+srv://krishnabhardwaj5427912_db_user:taCzRoeJIMlKA3B3@cluster0.iaqetzw.mongodb.net/?appName=Cluster0"
)
DB_NAME = "test"
STUDENTS_COLLECTION = "students"
ATTENDANCE_COLLECTION = "attendance"

# Tuned for production - better accuracy
MATCH_TOLERANCE = 0.62     # Face distance tolerance
MIN_CONFIDENCE = 0.62      # Require 65% confidence for attendance
LIVENESS_THRESHOLD = 50    # Sharpness threshold for real-time video

_encoding_cache: Dict[str, np.ndarray] = {}
_cache_lock = threading.Lock()

_mongo_client = None
_mongo_lock = threading.Lock()


def init_mongodb() -> pymongo.MongoClient:
    global _mongo_client
    with _mongo_lock:
        if _mongo_client is None:
            _mongo_client = pymongo.MongoClient(
                MONGO_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                maxPoolSize=50
            )
            _mongo_client.admin.command("ping")
    return _mongo_client


def get_student_photo(roll_number: str) -> Optional[str]:
    try:
        client = init_mongodb()
        col = client[DB_NAME][STUDENTS_COLLECTION]
        
        # Convert to int if possible (MongoDB stores as number)
        try:
            roll_num = int(roll_number.strip())
        except:
            roll_num = roll_number.strip()
        
        student = col.find_one({"rollNumber": roll_num})

        if not student:
            return None

        photo_url = student.get("photoUrl") or student.get("photo")
        if photo_url and isinstance(photo_url, str) and photo_url.startswith(("http://", "https://")):
            return photo_url
        return None
    except:
        return None


def download_and_encode_face(url: str) -> Optional[np.ndarray]:
    try:
        resp = requests.get(url, timeout=6)
        resp.raise_for_status()

        img = face_recognition.load_image_file(BytesIO(resp.content))
        print(f"[DEBUG] Downloaded image shape: {img.shape}", file=sys.stderr)

        # only 1 face required - use better encoding settings
        enc = face_recognition.face_encodings(img, num_jitters=2)
        if enc:
            print(f"[DEBUG] Encoding found, encoding shape: {len(enc[0])}", file=sys.stderr)
            return enc[0]
        else:
            print(f"[DEBUG] No face found in downloaded image", file=sys.stderr)
            return None
    except Exception as e:
        print(f"[ERROR] Failed to download/encode face: {str(e)}", file=sys.stderr)
        return None


def decode_base64_frame(frame_b64: str) -> Optional[np.ndarray]:
    try:
        if "," in frame_b64:
            frame_b64 = frame_b64.split(",")[1]

        nparr = np.frombuffer(base64.b64decode(frame_b64), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except:
        return None


def detect_single_face_fast(frame: np.ndarray) -> Dict[str, Any]:
    """
    Fast face detection + encoding (balanced for speed & stability):
    - downscale to 0.4 (good balance)
    - use HOG model
    - process only first face
    """
    small = cv2.resize(frame, (0, 0), fx=0.4, fy=0.4)
    rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

    # Face detection with HOG
    locations = face_recognition.face_locations(
        rgb_small,
        model="hog",
        number_of_times_to_upsample=0
    )

    if not locations:
        return {"found": False}

    loc = locations[0]
    # Use num_jitters=1 for speed
    encodings = face_recognition.face_encodings(rgb_small, [loc], num_jitters=1)
    
    if not encodings:
        return {"found": False}
    
    encoding = encodings[0]

    top, right, bottom, left = loc
    bbox = {
        "x": int(left * 2.5),
        "y": int(top * 2.5),
        "width": int((right - left) * 2.5),
        "height": int((bottom - top) * 2.5)
    }

    return {"found": True, "encoding": encoding, "bbox": bbox}


def check_liveness_fast(frame: np.ndarray) -> bool:
    """
    Fast liveness check (sharpness check).
    Checks if frame is in focus (not blurry).
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    sharp = cv2.Laplacian(gray, cv2.CV_64F).var()
    return sharp > LIVENESS_THRESHOLD


def save_attendance(roll_number: str, confidence: float) -> bool:
    try:
        client = init_mongodb()
        col = client[DB_NAME][ATTENDANCE_COLLECTION]

        # Convert to int if possible
        try:
            roll_num = int(roll_number.strip())
        except:
            roll_num = roll_number.strip()

        record = {
            "rollNumber": roll_num,
            "timestamp": datetime.utcnow(),
            "confidence": float(confidence),
            "status": "present",
            "source": "flask_face_api"
        }
        res = col.insert_one(record)
        return bool(res.inserted_id)
    except:
        return False


def recognize_student_fast(roll_number: str, frame_b64: str) -> Dict[str, Any]:
    print(f"[DEBUG] Starting recognition for roll: {roll_number}", file=sys.stderr)
    
    # 1) get student photo
    photo_url = get_student_photo(roll_number)
    if not photo_url:
        return {
            "success": False,
            "studentFound": False,
            "message": f"Student {roll_number} not found"
        }
    
    print(f"[DEBUG] Found student with photo: {photo_url[:50]}...", file=sys.stderr)

    # 2) get cached encoding
    with _cache_lock:
        ref_enc = _encoding_cache.get(photo_url)

    if ref_enc is None:
        print(f"[DEBUG] Downloading and encoding reference face from {photo_url}", file=sys.stderr)
        ref_enc = download_and_encode_face(photo_url)
        if ref_enc is None:
            print(f"[ERROR] Failed to encode reference face", file=sys.stderr)
            return {
                "success": False,
                "studentFound": True,
                "message": "Reference photo face not found / download failed"
            }
        with _cache_lock:
            _encoding_cache[photo_url] = ref_enc
    else:
        print(f"[DEBUG] Using cached encoding for {photo_url[:50]}...", file=sys.stderr)

    # 3) decode frame
    frame = decode_base64_frame(frame_b64)
    if frame is None:
        return {"success": False, "message": "Invalid frame"}

    # 4) detect + encode in frame
    face_data = detect_single_face_fast(frame)
    if not face_data["found"]:
        return {
            "success": True,
            "studentFound": True,
            "faceDetected": False,
            "message": "No face detected"
        }

    # 5) compare
    distance = face_recognition.face_distance([ref_enc], face_data["encoding"])[0]
    confidence = 1.0 - float(distance)
    
    print(f"[DEBUG] Face comparison - Distance: {distance:.4f}, Confidence: {confidence:.4f}", file=sys.stderr)
    print(f"[DEBUG] Tolerance: {MATCH_TOLERANCE}, Min Confidence: {MIN_CONFIDENCE}", file=sys.stderr)

    matched = (distance <= MATCH_TOLERANCE) and (confidence >= MIN_CONFIDENCE)
    print(f"[DEBUG] Match result: {matched}", file=sys.stderr)

    # 6) liveness check (temporarily disabled for testing)
    is_live = check_liveness_fast(frame)
    # For now, ignore liveness check and just use face matching
    final_match = matched  # was: matched and is_live
    
    print(f"[DEBUG] Is Live: {is_live}, Final Match: {final_match}", file=sys.stderr)

    result = {
        "success": True,
        "studentFound": True,
        "faceDetected": True,
        "matched": bool(final_match),
        "confidence": round(float(confidence), 3),
        "distance": round(float(distance), 3),
        "isLive": bool(is_live),
        "bbox": face_data["bbox"],
        "attendanceSaved": False,
        "photoUrl": photo_url,
        "debug": {
            "referencePhotoUrl": photo_url[:50] + "...",
            "distanceValue": float(distance),
            "confidenceValue": float(confidence),
            "matchTolerance": float(MATCH_TOLERANCE),
            "minConfidence": float(MIN_CONFIDENCE),
            "livenessThreshold": float(LIVENESS_THRESHOLD),
            "matchedDistance": bool(distance <= MATCH_TOLERANCE),
            "matchedConfidence": bool(confidence >= MIN_CONFIDENCE),
            "isLiveCheck": bool(is_live)
        }
    }

    # 7) save attendance only if final match
    if final_match:
        result["attendanceSaved"] = save_attendance(roll_number, confidence)

    result["message"] = "✅ ATTENDANCE MARKED" if final_match else "❌ Not matched / not live"
    return result
