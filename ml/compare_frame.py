import sys
import json
import cv2
import numpy as np
import face_recognition
import base64
from io import BytesIO
from PIL import Image
import requests
import tempfile
import os

def load_registered_image(url):
    """Download and encode registered image - Optimized for speed"""
    try:
        # Reduced timeout to 5 seconds
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        
        # Use BytesIO instead of temp file for faster processing
        image_data = BytesIO(response.content)
        image = face_recognition.load_image_file(image_data)
        encodings = face_recognition.face_encodings(image, num_jitters=1)  # Faster encoding
        
        return encodings[0] if encodings else None
        
    except Exception as e:
        print(f"Error loading registered image: {str(e)}", file=sys.stderr)
        return None

def decode_frame(frame_data):
    """Decode base64 frame to numpy array"""
    try:
        # Remove data:image/jpeg;base64, prefix if present
        if ',' in frame_data:
            frame_data = frame_data.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(frame_data)
        
        # Convert to PIL Image
        image = Image.open(BytesIO(image_data))
        
        # Convert to numpy array (RGB)
        return np.array(image)
        
    except Exception as e:
        print(f"Error decoding frame: {str(e)}", file=sys.stderr)
        return None

def compare_frame(registered_url, frame_data):
    """Compare captured frame with registered face"""
    try:
        # Load registered face encoding
        registered_encoding = load_registered_image(registered_url)
        if registered_encoding is None:
            return {'faceDetected': False, 'error': 'Failed to load registered image'}
        
        # Decode frame
        frame = decode_frame(frame_data)
        if frame is None:
            return {'faceDetected': False, 'error': 'Failed to decode frame'}
        
        # Convert BGR to RGB if needed
        if len(frame.shape) == 3 and frame.shape[2] == 3:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        else:
            rgb_frame = frame
        
        # Detect faces in frame - Use faster model
        face_locations = face_recognition.face_locations(rgb_frame, model='hog', number_of_times_to_upsample=1)
        
        if not face_locations:
            return {'faceDetected': False}
        
        # Get face encodings - Faster with fewer jitters
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations, num_jitters=1)
        
        if not face_encodings:
            return {'faceDetected': False}
        
        # Compare with registered face
        face_location = face_locations[0]
        face_encoding = face_encodings[0]
        
        # Get face boundary
        top, right, bottom, left = face_location
        
        # Compare faces - Balanced matching to prevent proxy but allow legitimate matches
        # Tolerance 0.6 is standard (0.4 is very strict, 0.6 is balanced)
        matches = face_recognition.compare_faces([registered_encoding], face_encoding, tolerance=0.6)
        distance = face_recognition.face_distance([registered_encoding], face_encoding)
        
        # Calculate confidence
        confidence = float(1 - distance[0])
        # Require moderate confidence (0.5 = 50% match) to allow legitimate matches
        matched = bool(matches[0]) and confidence > 0.5
        
        return {
            'faceDetected': True,
            'matched': matched,
            'confidence': confidence,
            'x': int(left),
            'y': int(top),
            'width': int(right - left),
            'height': int(bottom - top)
        }
        
    except Exception as e:
        print(f"Error in compare_frame: {str(e)}", file=sys.stderr)
        return {'faceDetected': False, 'error': str(e)}

if __name__ == '__main__':
    try:
        if len(sys.argv) < 3:
            print(json.dumps({'faceDetected': False, 'error': 'Missing arguments'}), flush=True)
            sys.exit(1)
        
        registered_url = sys.argv[1]
        frame_data = sys.argv[2]
        
        # Validate inputs
        if not registered_url or not frame_data:
            print(json.dumps({'faceDetected': False, 'error': 'Invalid arguments'}), flush=True)
            sys.exit(1)
        
        result = compare_frame(registered_url, frame_data)
        # Flush output immediately to prevent buffering
        print(json.dumps(result), flush=True)
        sys.exit(0)
        
    except KeyboardInterrupt:
        print(json.dumps({'faceDetected': False, 'error': 'Interrupted'}), flush=True)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'faceDetected': False, 'error': str(e)}), flush=True)
        sys.exit(1)