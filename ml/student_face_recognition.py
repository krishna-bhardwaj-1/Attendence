import sys
import json
import cv2
import numpy as np
import face_recognition
import logging
import requests
import os
import tempfile
import base64
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

class FaceRecognitionStream:
    def __init__(self, registered_image_url, roll_number):
        self.registered_image_url = registered_image_url
        self.roll_number = roll_number
        self.registered_encoding = None
        self.camera = None
        self.consecutive_matches = 0
        self.required_matches = 5
        self.best_confidence = 0.0
        self.recognition_complete = False
        self.success = False
        
        # Frame processing optimization - AGGRESSIVE
        self.frame_skip = 3  # Process every 4th frame (skip 3 frames)
        self.frame_counter = 0
        self.last_result = None
        
    def download_and_encode_registered_image(self):
        try:
            logger.info(f"Downloading registered image: {self.registered_image_url}")
            
            response = requests.get(self.registered_image_url, timeout=10)
            response.raise_for_status()
            
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            temp_file.write(response.content)
            temp_file.close()
            
            image = face_recognition.load_image_file(temp_file.name)
            
            # Use num_jitters=1 for faster encoding (still accurate)
            face_encodings = face_recognition.face_encodings(image, num_jitters=1)
            
            try:
                os.unlink(temp_file.name)
            except:
                pass
            
            if len(face_encodings) == 0:
                logger.error("No face found in registered image")
                return False
            
            self.registered_encoding = face_encodings[0]
            logger.info("✓ Registered face encoding extracted")
            return True
            
        except Exception as e:
            logger.error(f"Error loading registered image: {str(e)}")
            return False
    
    def initialize_camera(self):
        """Initialize camera with optimal settings"""
        try:
            logger.info("Initializing camera...")
            self.camera = cv2.VideoCapture(0)
            
            if not self.camera.isOpened():
                logger.error("Failed to open camera")
                return False
            
            # Optimize camera settings for performance
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer for lower latency
            
            # Warm up camera
            for _ in range(3):
                ret, _ = self.camera.read()
                if not ret:
                    logger.error("Camera warmup failed")
                    return False
            
            logger.info("✓ Camera initialized")
            return True
            
        except Exception as e:
            logger.error(f"Camera initialization error: {str(e)}")
            return False
    
    def draw_face_boundary(self, frame, face_location, is_match, confidence):
        """Draw boundary box around detected face"""
        top, right, bottom, left = face_location
        
        if is_match:
            color = (0, 255, 0)
            thickness = 4
            label_bg = (0, 255, 0)
        else:
            color = (0, 0, 255)
            thickness = 3
            label_bg = (0, 0, 255)
        
        # Draw main rectangle
        cv2.rectangle(frame, (left, top), (right, bottom), color, thickness)
        
        # Draw corner markers
        marker_length = 30
        
        # Top-left
        cv2.line(frame, (left, top), (left + marker_length, top), color, thickness)
        cv2.line(frame, (left, top), (left, top + marker_length), color, thickness)
        
        # Top-right
        cv2.line(frame, (right, top), (right - marker_length, top), color, thickness)
        cv2.line(frame, (right, top), (right, top + marker_length), color, thickness)
        
        # Bottom-left
        cv2.line(frame, (left, bottom), (left + marker_length, bottom), color, thickness)
        cv2.line(frame, (left, bottom), (left, bottom - marker_length), color, thickness)
        
        # Bottom-right
        cv2.line(frame, (right, bottom), (right - marker_length, bottom), color, thickness)
        cv2.line(frame, (right, bottom), (right, bottom - marker_length), color, thickness)
        
        # Confidence label
        confidence_percent = int(confidence * 100)
        label = f"{confidence_percent}% {'MATCH' if is_match else 'NO MATCH'}"
        
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
        cv2.rectangle(frame, (left, top - 35), (left + label_size[0] + 10, top - 5), label_bg, -1)
        cv2.putText(frame, label, (left + 5, top - 15), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Match counter
        if is_match:
            counter_label = f"Match {self.consecutive_matches}/{self.required_matches}"
            cv2.putText(frame, counter_label, (left + 5, bottom + 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        return frame
    
    def add_status_overlay(self, frame, status_text, status_color=(255, 255, 255)):
        """Add status text overlay"""
        height, width = frame.shape[:2]
        
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, 50), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        cv2.putText(frame, status_text, (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        cv2.putText(frame, timestamp, (width - 120, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        
        return frame
    
    def process_frame(self):
        """Process frame with optimization - skip frames for performance"""
        ret, frame = self.camera.read()
        
        if not ret:
            logger.error("Failed to read frame")
            return None, None
        
        frame = cv2.flip(frame, 1)
        
        # Frame skip logic - process every 4th frame for smoother video
        self.frame_counter += 1
        should_process = (self.frame_counter % 4 == 0)
        
        if not should_process and self.last_result is not None:
            # Use cached result and draw on current frame
            if self.last_result.get('face_detected') and 'face_location' in self.last_result:
                frame = self.draw_face_boundary(
                    frame,
                    self.last_result['face_location'],
                    self.last_result['match'],
                    self.last_result['confidence']
                )
                status_text = self.last_result.get('status_text', 'Processing...')
                status_color = self.last_result.get('status_color', (255, 255, 255))
                frame = self.add_status_overlay(frame, status_text, status_color)
            else:
                # No face in cache, show waiting message
                frame = self.add_status_overlay(frame, "Initializing...", (255, 255, 255))
            
            return frame, self.last_result
        
        # Actually process this frame
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Resize for faster processing - 25% size = 16x faster
        small_frame = cv2.resize(rgb_frame, (0, 0), fx=0.25, fy=0.25)
        
        # Use HOG model (much faster than CNN)
        face_locations = face_recognition.face_locations(
            small_frame, 
            model='hog',
            number_of_times_to_upsample=0  # 0 = faster, 1 = more accurate
        )
        
        if len(face_locations) == 0:
            self.consecutive_matches = 0
            frame = self.add_status_overlay(frame, "No face detected - Position your face", (0, 165, 255))
            
            result = {
                'face_detected': False,
                'match': False,
                'confidence': 0.0,
                'consecutive_matches': 0,
                'status_text': "No face detected - Position your face",
                'status_color': (0, 165, 255)
            }
            self.last_result = result
            return frame, result
        
        # Get first face encoding only
        face_encodings = face_recognition.face_encodings(
            small_frame, 
            face_locations,
            num_jitters=1  # Reduce jitters for speed
        )
        
        if len(face_encodings) == 0:
            self.consecutive_matches = 0
            frame = self.add_status_overlay(frame, "Face detected but cannot encode", (0, 165, 255))
            
            result = {
                'face_detected': True,
                'match': False,
                'confidence': 0.0,
                'consecutive_matches': 0,
                'status_text': "Face detected but cannot encode",
                'status_color': (0, 165, 255)
            }
            self.last_result = result
            return frame, result
        
        # Compare with registered face
        face_encoding = face_encodings[0]
        face_location = face_locations[0]
        
        # Scale back to original size (4x since we used 0.25)
        top, right, bottom, left = face_location
        top *= 4
        right *= 4
        bottom *= 4
        left *= 4
        scaled_location = (top, right, bottom, left)
        
        # Fast comparison with tolerance
        matches = face_recognition.compare_faces(
            [self.registered_encoding], 
            face_encoding, 
            tolerance=0.5
        )
        face_distance = face_recognition.face_distance(
            [self.registered_encoding], 
            face_encoding
        )
        
        confidence = 1 - face_distance[0]
        is_match = matches[0] and confidence > 0.45
        
        if confidence > self.best_confidence:
            self.best_confidence = confidence
        
        # Update matches
        if is_match:
            self.consecutive_matches += 1
            status_text = f"Face Matched! ({self.consecutive_matches}/{self.required_matches})"
            status_color = (0, 255, 0)
        else:
            self.consecutive_matches = 0
            status_text = f"Scanning... {int(confidence * 100)}%"
            status_color = (0, 0, 255)
        
        # Draw visualization
        frame = self.draw_face_boundary(frame, scaled_location, is_match, confidence)
        frame = self.add_status_overlay(frame, status_text, status_color)
        
        # Check completion
        if self.consecutive_matches >= self.required_matches:
            self.recognition_complete = True
            self.success = True
            logger.info(f"✓ RECOGNITION COMPLETE! Confidence: {confidence:.2f}")
        
        result = {
            'face_detected': True,
            'match': is_match,
            'confidence': float(confidence),
            'consecutive_matches': self.consecutive_matches,
            'recognition_complete': self.recognition_complete,
            'face_location': scaled_location,
            'status_text': status_text,
            'status_color': status_color
        }
        
        # Cache result
        self.last_result = result
        
        return frame, result
    
    def frame_to_base64(self, frame):
        """Convert frame to base64 with aggressive compression"""
        _, buffer = cv2.imencode('.jpg', frame, [
            cv2.IMWRITE_JPEG_QUALITY, 60,  # Lower quality for faster encoding
            cv2.IMWRITE_JPEG_OPTIMIZE, 1
        ])
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        return jpg_as_text
    
    def run(self):
        """Main recognition loop - optimized"""
        try:
            if not self.download_and_encode_registered_image():
                return {
                    'success': False,
                    'error': 'Failed to load registered image'
                }
            
            if not self.initialize_camera():
                return {
                    'success': False,
                    'error': 'Failed to initialize camera'
                }
            
            logger.info("Starting face recognition stream...")
            
            frame_count = 0
            max_frames = 600  # 20 seconds at 30fps
            
            while frame_count < max_frames and not self.recognition_complete:
                frame, result = self.process_frame()
                
                if frame is None:
                    continue
                
                frame_base64 = self.frame_to_base64(frame)
                
                output = {
                    'type': 'frame',
                    'frame': frame_base64,
                    'result': result
                }
                
                print(json.dumps(output), flush=True)
                
                frame_count += 1
                
                # No delay - let it run as fast as possible
                # cv2.waitKey(1)  # Minimal or no delay
            
            # Final result
            if self.recognition_complete and self.success:
                final_result = {
                    'type': 'final',
                    'success': True,
                    'recognized': True,
                    'rollNumber': self.roll_number,
                    'confidence': float(self.best_confidence),
                    'message': 'Attendance marked successfully'
                }
            else:
                final_result = {
                    'type': 'final',
                    'success': False,
                    'recognized': False,
                    'rollNumber': self.roll_number,
                    'confidence': float(self.best_confidence),
                    'message': f'Face not recognized. Best confidence: {self.best_confidence*100:.1f}%'
                }
            
            print(json.dumps(final_result), flush=True)
            return final_result
            
        except Exception as e:
            logger.error(f"Error in recognition loop: {str(e)}", exc_info=True)
            return {
                'type': 'final',
                'success': False,
                'error': str(e)
            }
        finally:
            if self.camera:
                self.camera.release()
                logger.info("Camera released")

if __name__ == '__main__':
    try:
        if len(sys.argv) < 3:
            error_result = {
                'type': 'final',
                'success': False,
                'error': 'Missing arguments: registered_image_url and roll_number required'
            }
            print(json.dumps(error_result), flush=True)
            sys.exit(1)
        
        registered_image_url = sys.argv[1]
        roll_number = sys.argv[2]
        
        logger.info(f"Starting face recognition for roll number: {roll_number}")
        logger.info(f"Registered image: {registered_image_url}")
        
        recognizer = FaceRecognitionStream(registered_image_url, roll_number)
        result = recognizer.run()
        
        if result.get('success'):
            sys.exit(0)
        else:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        error_result = {
            'type': 'final',
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result), flush=True)
        sys.exit(1)