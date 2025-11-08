import sys
import json
import cv2
import numpy as np
import face_recognition
import logging
import requests
import os
import tempfile
import time

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def download_image_from_url(image_url):
    """Download image from URL and save to temporary file"""
    try:
        logger.info(f"Downloading registration image from URL: {image_url}")
        response = requests.get(image_url, timeout=15)
        response.raise_for_status()
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        temp_file.write(response.content)
        temp_file.close()
        
        logger.info(f"Registration image saved: {temp_file.name}")
        return temp_file.name
    except Exception as e:
        logger.error(f"Error downloading image: {str(e)}")
        raise

def load_image(image_path):
    """Load image from URL or local file"""
    try:
        if image_path.startswith('http://') or image_path.startswith('https://'):
            local_path = download_image_from_url(image_path)
            image = face_recognition.load_image_file(local_path)
            os.unlink(local_path)
            return image
        else:
            image = face_recognition.load_image_file(image_path)
            return image
    except Exception as e:
        logger.error(f"Error loading image: {str(e)}")
        raise

def get_registered_encoding(image_path, roll_number):
    """Get face encoding from registered student image"""
    try:
        logger.info(f"Loading registered image for {roll_number}")
        image = load_image(image_path)
        
        face_encodings = face_recognition.face_encodings(image)
        
        if len(face_encodings) == 0:
            logger.error("No face detected in registered image")
            return None
        
        if len(face_encodings) > 1:
            logger.warning("Multiple faces in registered image, using first")
        
        logger.info("Registered face encoding extracted")
        return face_encodings[0]
        
    except Exception as e:
        logger.error(f"Error getting registered encoding: {str(e)}")
        raise

def recognize_face_from_camera(registered_image_path, roll_number, timeout=30):
    """
    Capture video from camera and compare with registered image in real-time
    Shows face boundary box and recognition status
    """
    try:
        logger.info(f"Starting face recognition for {roll_number}")
        
        # Get registered face encoding
        registered_encoding = get_registered_encoding(registered_image_path, roll_number)
        
        if registered_encoding is None:
            return {
                'success': False,
                'recognized': False,
                'message': 'Could not extract face from registered image',
                'confidence': 0.0
            }
        
        logger.info("Initializing camera...")
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            logger.error("Failed to open camera")
            return {
                'success': False,
                'recognized': False,
                'message': 'Camera not found or cannot be opened',
                'confidence': 0.0
            }
        
        logger.info("Camera opened successfully")
        
        # Set camera properties for better quality
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        # Warm up camera
        logger.info("Warming up camera...")
        for i in range(10):
            cap.read()
            time.sleep(0.1)
        
        start_time = time.time()
        best_confidence = 0.0
        best_match = False
        frame_count = 0
        consecutive_matches = 0
        
        logger.info(f"Starting real-time face detection (timeout: {timeout}s)")
        
        # Create window
        window_name = 'Face Recognition - Look at the camera'
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, 1000, 700)
        
        while True:
            elapsed_time = time.time() - start_time
            
            if elapsed_time > timeout:
                logger.info("Timeout reached")
                cap.release()
                cv2.destroyAllWindows()
                
                if best_match and consecutive_matches >= 3:
                    logger.info(f"✓ Face recognized with confidence {best_confidence:.2f}")
                    return {
                        'success': True,
                        'recognized': True,
                        'rollNumber': roll_number,
                        'message': 'Face recognized successfully',
                        'confidence': float(best_confidence),
                        'frames_processed': frame_count
                    }
                else:
                    logger.warning(f"Face not recognized (best: {best_confidence:.2f})")
                    return {
                        'success': False,
                        'recognized': False,
                        'message': f'Face not recognized. Best confidence: {best_confidence*100:.1f}%',
                        'confidence': float(best_confidence),
                        'frames_processed': frame_count
                    }
            
            ret, frame = cap.read()
            
            if not ret:
                logger.error("Failed to read from camera")
                continue
            
            frame_count += 1
            
            # Create display frame
            display_frame = frame.copy()
            
            # Resize for faster processing
            small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
            rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            
            # Detect faces
            try:
                face_locations = face_recognition.face_locations(rgb_small_frame, model='hog')
                face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
                
                if len(face_encodings) > 0:
                    # Scale back face location
                    top, right, bottom, left = [v * 4 for v in face_locations[0]]
                    
                    # Compare faces
                    matches = face_recognition.compare_faces([registered_encoding], face_encodings[0], tolerance=0.5)
                    face_distances = face_recognition.face_distance([registered_encoding], face_encodings[0])
                    
                    confidence = 1 - face_distances[0]
                    
                    if confidence > best_confidence:
                        best_confidence = confidence
                    
                    # Determine match status
                    if matches[0] and confidence > 0.45:
                        box_color = (0, 255, 0)  # Green
                        status = f"MATCH! {confidence*100:.1f}%"
                        text_color = (0, 255, 0)
                        consecutive_matches += 1
                        best_match = True
                        
                        logger.info(f"✓ Match! Confidence: {confidence:.2f} (consecutive: {consecutive_matches})")
                        
                        # Confirm after 3 consecutive matches
                        if consecutive_matches >= 3 and frame_count > 15:
                            cap.release()
                            cv2.destroyAllWindows()
                            return {
                                'success': True,
                                'recognized': True,
                                'rollNumber': roll_number,
                                'message': 'Face recognized successfully',
                                'confidence': float(confidence),
                                'frames_processed': frame_count
                            }
                    else:
                        box_color = (0, 165, 255)  # Orange
                        status = f"Checking... {confidence*100:.1f}%"
                        text_color = (0, 165, 255)
                        consecutive_matches = 0
                    
                    # Draw thick rectangle
                    cv2.rectangle(display_frame, (left, top), (right, bottom), box_color, 4)
                    
                    # Draw filled rectangle for text background
                    cv2.rectangle(display_frame, (left, bottom - 50), (right, bottom), box_color, cv2.FILLED)
                    cv2.putText(display_frame, status, (left + 10, bottom - 15), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                    
                    if frame_count % 10 == 0:
                        logger.info(f"Frame {frame_count}: Confidence {confidence:.2f}")
                else:
                    consecutive_matches = 0
                    cv2.putText(display_frame, "NO FACE DETECTED", (50, 70), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
                
                # Display info overlay
                time_left = int(timeout - elapsed_time)
                overlay = display_frame.copy()
                
                # Semi-transparent black background for text
                cv2.rectangle(overlay, (0, 0), (500, 150), (0, 0, 0), -1)
                cv2.addWeighted(overlay, 0.6, display_frame, 0.4, 0, display_frame)
                
                # Display information
                cv2.putText(display_frame, f"Roll Number: {roll_number}", (15, 35), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                cv2.putText(display_frame, f"Time Left: {time_left}s", (15, 70), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                cv2.putText(display_frame, f"Best Match: {best_confidence*100:.1f}%", (15, 105), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                cv2.putText(display_frame, f"Frames: {frame_count}", (15, 140), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                
                # Instructions at bottom
                instructions = "Look directly at the camera. Press ESC to cancel."
                cv2.putText(display_frame, instructions, (15, display_frame.shape[0] - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                # Show frame
                cv2.imshow(window_name, display_frame)
                
                # Check for ESC key
                key = cv2.waitKey(1) & 0xFF
                if key == 27:  # ESC
                    logger.info("User cancelled")
                    break
                
            except Exception as e:
                logger.warning(f"Error processing frame {frame_count}: {str(e)}")
                continue
        
        cap.release()
        cv2.destroyAllWindows()
        
        return {
            'success': False,
            'recognized': False,
            'message': 'Recognition cancelled or failed',
            'confidence': float(best_confidence),
            'frames_processed': frame_count
        }
        
    except Exception as e:
        logger.error(f"Error in face recognition: {str(e)}", exc_info=True)
        try:
            cv2.destroyAllWindows()
        except:
            pass
        return {
            'success': False,
            'recognized': False,
            'message': f'Error: {str(e)}',
            'confidence': 0.0
        }

if __name__ == '__main__':
    try:
        logger.info(f"Face recognition script started with {len(sys.argv)} arguments")
        
        if len(sys.argv) < 3:
            result = {
                'success': False,
                'recognized': False,
                'message': 'Missing arguments: image_path and roll_number required',
                'confidence': 0.0
            }
            print(json.dumps(result))
            sys.exit(1)
        
        image_path = sys.argv[1]
        roll_number = sys.argv[2]
        timeout = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        
        logger.info(f"Registered image: {image_path}")
        logger.info(f"Roll number: {roll_number}")
        logger.info(f"Timeout: {timeout}s")
        
        result = recognize_face_from_camera(image_path, roll_number, timeout)
        
        logger.info(f"Final result: {result}")
        print(json.dumps(result))
        
        if result['success'] and result['recognized']:
            sys.exit(0)
        else:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Script error: {str(e)}", exc_info=True)
        result = {
            'success': False,
            'recognized': False,
            'message': f'Script error: {str(e)}',
            'confidence': 0.0
        }
        print(json.dumps(result))
        try:
            cv2.destroyAllWindows()
        except:
            pass
        sys.exit(1)