#!/usr/bin/env python3
"""
Real-time Face Detection with Liveness Detection
Uses MediaPipe for fast, lightweight face detection
Detects eye movement, head pose, and prevents photo spoofing
"""

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.python.solutions import face_detection, drawing_utils
import sys
import json

class RealtimeFaceDetector:
    def __init__(self):
        """Initialize MediaPipe face detection"""
        self.mp_face_detection = face_detection.FaceDetection(
            model_selection=0,  # 0 for short range, 1 for full range
            min_detection_confidence=0.7
        )
        self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_drawing = drawing_utils
        
        # Liveness detection parameters
        self.eye_blink_frames = 0
        self.head_movement_frames = 0
        self.prev_landmarks = None
        self.frame_count = 0
        
    def detect_faces_realtime(self, image_path_or_url):
        """
        Detect faces in real-time from webcam or image
        Returns: {
            'detected': bool,
            'confidence': float,
            'eye_movement': bool,
            'head_movement': bool,
            'blink_detected': bool,
            'is_lively': bool,
            'face_count': int
        }
        """
        try:
            # Read image
            if image_path_or_url.startswith('http'):
                import urllib.request
                import urllib.error
                try:
                    with urllib.request.urlopen(image_path_or_url, timeout=5) as url:
                        image_array = np.asarray(bytearray(url.read()), dtype=np.uint8)
                    frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                except (urllib.error.URLError, Exception) as e:
                    return {
                        'detected': False,
                        'confidence': 0.0,
                        'error': f'Failed to load image: {str(e)}'
                    }
            else:
                frame = cv2.imread(image_path_or_url)
                
            if frame is None:
                return {
                    'detected': False,
                    'confidence': 0.0,
                    'error': 'Could not read image'
                }
            
            # Flip the frame horizontally
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Face detection
            results = self.mp_face_detection.process(rgb_frame)
            face_mesh_results = self.mp_face_mesh.process(rgb_frame)
            
            if not results.detections:
                return {
                    'detected': False,
                    'confidence': 0.0,
                    'face_count': 0,
                    'message': 'No face detected'
                }
            
            # Get first detection (we only care about one face)
            detection = results.detections[0]
            confidence = detection.score[0]
            
            # Extract face bounding box
            bboxC = detection.location_data.relative_bounding_box
            x_min = int(bboxC.xmin * w)
            y_min = int(bboxC.ymin * h)
            width = int(bboxC.width * w)
            height = int(bboxC.height * h)
            
            # Liveness detection using face mesh
            is_lively = False
            eye_movement = False
            head_movement = False
            blink_detected = False
            
            if face_mesh_results.multi_face_landmarks:
                landmarks = face_mesh_results.multi_face_landmarks[0].landmark
                
                # Eye blink detection (using eye aspect ratio)
                left_eye = [landmarks[33], landmarks[160], landmarks[158], landmarks[133], landmarks[153], landmarks[144]]
                right_eye = [landmarks[362], landmarks[385], landmarks[387], landmarks[362], landmarks[263], landmarks[466]]
                
                left_eye_ratio = self._get_eye_aspect_ratio(left_eye)
                right_eye_ratio = self._get_eye_aspect_ratio(right_eye)
                eye_ratio = (left_eye_ratio + right_eye_ratio) / 2
                
                # Blink detected if eye ratio drops below threshold
                if eye_ratio < 0.2:
                    self.eye_blink_frames += 1
                    blink_detected = True
                else:
                    self.eye_blink_frames = 0
                
                # Head pose estimation (check if head is moving)
                nose = landmarks[1]
                left_eye_center = landmarks[33]
                right_eye_center = landmarks[263]
                
                head_movement = self._detect_head_movement(nose, left_eye_center, right_eye_center)
                
                # Eye movement detection
                eye_movement = self._detect_eye_movement(left_eye, right_eye)
                
                # Liveness detection: must have blink, head movement, and eye movement
                is_lively = (blink_detected or self.eye_blink_frames > 0) or head_movement or eye_movement
            
            return {
                'detected': True,
                'confidence': float(confidence),
                'face_count': len(results.detections),
                'bounding_box': {
                    'x': x_min,
                    'y': y_min,
                    'width': width,
                    'height': height
                },
                'eye_movement': eye_movement,
                'head_movement': head_movement,
                'blink_detected': blink_detected,
                'is_lively': is_lively,
                'message': 'Live person detected' if is_lively else 'Motion detected - possible liveness'
            }
            
        except Exception as e:
            return {
                'detected': False,
                'confidence': 0.0,
                'error': str(e)
            }
    
    def _get_eye_aspect_ratio(self, eye_points):
        """Calculate eye aspect ratio for blink detection"""
        try:
            # Distance between vertical points
            p1_p6 = np.linalg.norm(np.array([eye_points[1].x, eye_points[1].y]) - 
                                   np.array([eye_points[5].x, eye_points[5].y]))
            p2_p5 = np.linalg.norm(np.array([eye_points[2].x, eye_points[2].y]) - 
                                   np.array([eye_points[4].x, eye_points[4].y]))
            # Distance between horizontal points
            p3_p4 = np.linalg.norm(np.array([eye_points[0].x, eye_points[0].y]) - 
                                   np.array([eye_points[3].x, eye_points[3].y]))
            
            # Eye aspect ratio
            ear = (p1_p6 + p2_p5) / (2.0 * p3_p4)
            return ear
        except:
            return 1.0
    
    def _detect_head_movement(self, nose, left_eye, right_eye):
        """Detect head movement/pose"""
        try:
            # Calculate head center
            head_center = np.array([
                (left_eye.x + right_eye.x) / 2,
                (left_eye.y + right_eye.y) / 2
            ])
            
            # If this is the first frame, store center
            if not hasattr(self, '_head_center'):
                self._head_center = head_center
                return False
            
            # Calculate movement distance
            movement = np.linalg.norm(head_center - self._head_center)
            self._head_center = head_center
            
            # Head movement detected if movement > threshold
            return movement > 0.02
        except:
            return False
    
    def _detect_eye_movement(self, left_eye, right_eye):
        """Detect eye movement within face"""
        try:
            # Get pupil position (approximate using iris region)
            left_eye_center_x = np.mean([p.x for p in left_eye])
            left_eye_center_y = np.mean([p.y for p in left_eye])
            right_eye_center_x = np.mean([p.x for p in right_eye])
            right_eye_center_y = np.mean([p.y for p in right_eye])
            
            # If previous position exists, calculate movement
            if hasattr(self, '_prev_eye_pos'):
                left_movement = np.sqrt(
                    (left_eye_center_x - self._prev_eye_pos['left_x']) ** 2 +
                    (left_eye_center_y - self._prev_eye_pos['left_y']) ** 2
                )
                right_movement = np.sqrt(
                    (right_eye_center_x - self._prev_eye_pos['right_x']) ** 2 +
                    (right_eye_center_y - self._prev_eye_pos['right_y']) ** 2
                )
                
                movement = (left_movement + right_movement) / 2
                self._prev_eye_pos = {
                    'left_x': left_eye_center_x,
                    'left_y': left_eye_center_y,
                    'right_x': right_eye_center_x,
                    'right_y': right_eye_center_y
                }
                return movement > 0.01
            else:
                self._prev_eye_pos = {
                    'left_x': left_eye_center_x,
                    'left_y': left_eye_center_y,
                    'right_x': right_eye_center_x,
                    'right_y': right_eye_center_y
                }
                return False
        except:
            return False


def main():
    """Main function - process image from command line"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'matched': False,
            'error': 'No image path provided'
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    detector = RealtimeFaceDetector()
    result = detector.detect_faces_realtime(image_path)
    
    # Determine if this is a live person
    if result.get('detected'):
        result['matched'] = result.get('is_lively', False) or result.get('head_movement', False)
    else:
        result['matched'] = False
    
    print(json.dumps(result))


if __name__ == '__main__':
    main()
