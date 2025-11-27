import sys
import json
import cv2
import numpy as np
import face_recognition
import base64
from io import BytesIO
from PIL import Image
import requests

# Global cache for registered encodings
_encoding_cache = {}

def load_registered_image(url):
    """Download and encode registered image - with caching"""
    global _encoding_cache
    
    # Check cache first
    if url in _encoding_cache:
        return _encoding_cache[url]
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        
        image_data = BytesIO(response.content)
        image = face_recognition.load_image_file(image_data)
        
        # Use num_jitters=1 for speed (default is 1, but explicit is better)
        encodings = face_recognition.face_encodings(image, num_jitters=1)
        
        if encodings:
            _encoding_cache[url] = encodings[0]
            return encodings[0]
        return None
        
    except Exception as e:
        print(f"Error loading registered image: {str(e)}", file=sys.stderr)
        return None

def decode_frame(frame_data):
    """Decode base64 frame to numpy array - optimized"""
    try:
        if ',' in frame_data:
            frame_data = frame_data.split(',')[1]
        
        image_data = base64.b64decode(frame_data)
        
        # Use numpy for faster conversion
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        return frame
        
    except Exception as e:
        print(f"Error decoding frame: {str(e)}", file=sys.stderr)
        return None

def compare_frame(registered_url, frame_data):
    """Compare captured frame with registered face - optimized"""
    try:
        # Load registered face encoding (cached)
        registered_encoding = load_registered_image(registered_url)
        if registered_encoding is None:
            return {'faceDetected': False, 'error': 'Failed to load registered image'}
        
        # Decode frame
        frame = decode_frame(frame_data)
        if frame is None:
            return {'faceDetected': False, 'error': 'Failed to decode frame'}
        
        # Resize frame for faster processing (50% size = 4x faster)
        small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        
        # Convert to RGB
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Use HOG 
        face_locations = face_recognition.face_locations(
            rgb_frame, 
            model='hog',
            number_of_times_to_upsample=0  #1 acc
        )
        
        if not face_locations:
            return {'faceDetected': False}
        
        # Process only the first face for speed
        face_location = face_locations[0]
        
        # Get encoding with minimal jitters
        face_encodings = face_recognition.face_encodings(
            rgb_frame, 
            [face_location], 
            num_jitters=1
        )
        
        if not face_encodings:
            return {'faceDetected': False}
        
        face_encoding = face_encodings[0]
        
        top, right, bottom, left = face_location
        top *= 2
        right *= 2
        bottom *= 2
        left *= 2
        
        # Compare faces
        matches = face_recognition.compare_faces(
            [registered_encoding], 
            face_encoding, 
            tolerance=0.6
        )
        distance = face_recognition.face_distance([registered_encoding], face_encoding)
        
        confidence = float(1 - distance[0])
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
        
        if not registered_url or not frame_data:
            print(json.dumps({'faceDetected': False, 'error': 'Invalid arguments'}), flush=True)
            sys.exit(1)
        
        result = compare_frame(registered_url, frame_data)
        print(json.dumps(result), flush=True)
        sys.exit(0)
        
    except KeyboardInterrupt:
        print(json.dumps({'faceDetected': False, 'error': 'Interrupted'}), flush=True)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'faceDetected': False, 'error': str(e)}), flush=True)
        sys.exit(1)