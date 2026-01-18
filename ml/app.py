from flask import Flask, request, jsonify
from recognition_service import recognize_student_fast
import time
import sys
import traceback
import json

app = Flask(__name__)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"success": True, "message": "API working ✅"})


@app.route("/recognize", methods=["POST"])
def recognize():
    """
    Real-time face recognition endpoint
    Body:
    {
      "rollNumber": "2315001170",
      "frame": "data:image/jpeg;base64,..."
    }
    """
    start = time.time()

    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "message": "No JSON body"}), 400

        roll_number = data.get("rollNumber")
        frame_b64 = data.get("frame")

        if not roll_number or not frame_b64:
            return jsonify({"success": False, "message": "rollNumber and frame required"}), 400

        # Call recognition service (fast real-time processing)
        result = recognize_student_fast(roll_number, frame_b64)

        result["apiTimeMs"] = round((time.time() - start) * 1000, 2)
        return jsonify(result)
    
    except Exception as e:
        error_msg = str(e)
        trace = traceback.format_exc()
        print(f"[ERROR] {error_msg}\n{trace}", file=sys.stderr)
        return jsonify({
            "success": False,
            "error": error_msg,
            "trace": trace
        }), 500


if __name__ == "__main__":
    # ⚡ threaded=True helps multiple concurrent requests
    # Real-time processing with fast response times
    print("\n" + "="*60)
    print("🚀 Smart Attendance Face Recognition API")
    print("="*60)
    print("📍 Running on http://localhost:9000")
    print("🔗 Endpoint: POST /recognize")
    print("⚡ Real-time face detection enabled")
    print("="*60 + "\n")
    app.run(host="0.0.0.0", port=9000, debug=False, threaded=True)
