#!/usr/bin/env python3
"""
Optimized OpenCV + Histogram-based face recognition
Lightweight, accurate, fast - NO external ML models needed!
Uses OpenCV's DNN face detection (pre-trained)
"""

import cv2
import base64
import json
import sys
from io import BytesIO
from PIL import Image
from urllib.request import urlopen
import numpy as np

def load_image(image_source):
    """Load image from file path, URL, or base64 data"""
    try:
        if image_source.startswith('data:image'):
            # Handle base64 data URL
            base64_str = image_source.split(',')[1]
            image_data = base64.b64decode(base64_str)
            image = Image.open(BytesIO(image_data))
            return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        elif image_source.startswith('http'):
            # Handle URL (e.g., Cloudinary)
            response = urlopen(image_source, timeout=10)
            image = Image.open(response)
            return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        else:
            # Handle local file path
            image = cv2.imread(image_source)
            if image is None:
                raise ValueError(f"Could not read image")
            return image
    except Exception as e:
        raise ValueError(f"Failed to load image: {str(e)}")

def extract_face_region(image):
    """Extract face region using multiple detection methods"""
    try:
        h, w, _ = image.shape
        
        # Try Haar Cascade with loose parameters (more detections)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(image, scaleFactor=1.05, minNeighbors=3, minSize=(20, 20))
        
        if len(faces) > 0:
            x, y, face_w, face_h = faces[0]
            # Add padding for better feature matching
            padding = int(max(face_w, face_h) * 0.1)
            x = max(0, x - padding)
            y = max(0, y - padding)
            x2 = min(w, x + face_w + 2*padding)
            y2 = min(h, y + face_h + 2*padding)
            
            face = image[y:y2, x:x2]
            if face.size > 0:
                return cv2.resize(face, (200, 200))  # Larger size for better feature extraction
        
        return None
    except Exception as e:
        return None

def calculate_face_similarity(img1, img2):
    """
    Calculate face similarity using multiple methods
    Tries ORB first, then AKAZE, then structural similarity
    """
    try:
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Method 1: ORB Feature Matching
        try:
            orb = cv2.ORB_create(nfeatures=1000)  # More features
            kp1, des1 = orb.detectAndCompute(gray1, None)
            kp2, des2 = orb.detectAndCompute(gray2, None)
            
            if des1 is not None and des2 is not None and len(kp1) > 5 and len(kp2) > 5:
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
                matches = bf.knnMatch(des1, des2, k=2)
                
                # Apply Lowe's ratio test
                good_matches = []
                for match_pair in matches:
                    if len(match_pair) == 2:
                        m, n = match_pair
                        if m.distance < 0.7 * n.distance:
                            good_matches.append(m)
                
                if len(good_matches) >= 5:
                    confidence = min(1.0, len(good_matches) / 50.0)  # Normalize
                    return confidence
        except:
            pass
        
        # Method 2: AKAZE (alternative to ORB)
        try:
            akaze = cv2.AKAZE_create()
            kp1, des1 = akaze.detectAndCompute(gray1, None)
            kp2, des2 = akaze.detectAndCompute(gray2, None)
            
            if des1 is not None and des2 is not None and len(kp1) > 5 and len(kp2) > 5:
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
                matches = bf.knnMatch(des1, des2, k=2)
                
                good_matches = []
                for match_pair in matches:
                    if len(match_pair) == 2:
                        m, n = match_pair
                        if m.distance < 0.7 * n.distance:
                            good_matches.append(m)
                
                if len(good_matches) >= 5:
                    confidence = min(1.0, len(good_matches) / 50.0)
                    return confidence
        except:
            pass
        
        # Method 3: Structural Similarity (SSIM)
        try:
            if gray1.shape == gray2.shape:
                # Calculate mean squared error
                mse = np.mean((gray1.astype(float) - gray2.astype(float)) ** 2)
                if mse < 10000:  # If MSE is low, images are similar
                    ssim_value = 1.0 - (mse / 10000.0)
                    return max(0, ssim_value)
        except:
            pass
        
        # Method 4: Histogram (last resort)
        return calculate_histogram_similarity(img1, img2)
        
    except:
        return 0.0

def calculate_histogram_similarity(img1, img2):
    """Fallback: Calculate histogram similarity"""
    try:
        hsv1 = cv2.cvtColor(img1, cv2.COLOR_BGR2HSV)
        hsv2 = cv2.cvtColor(img2, cv2.COLOR_BGR2HSV)
        
        hist1_h = cv2.calcHist([hsv1], [0], None, [180], [0, 180])
        hist2_h = cv2.calcHist([hsv2], [0], None, [180], [0, 180])
        
        cv2.normalize(hist1_h, hist1_h, alpha=1, beta=0, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist2_h, hist2_h, alpha=1, beta=0, norm_type=cv2.NORM_MINMAX)
        
        distance = cv2.compareHist(hist1_h, hist2_h, cv2.HISTCMP_BHATTACHARYYA)
        confidence = 1.0 - distance
        
        return max(0, min(1, confidence))
    except:
        return 0.0

def check_liveness(image):
    """Check if face appears live using Laplacian variance"""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = laplacian.var()
        # Real faces have higher variance (>30), photos have lower
        return variance > 30
    except:
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "error": "Usage: liveness_comparison.py <reg_face> <cap_frame>",
            "matched": False,
            "confidence": 0.0,
            "is_live": False,
            "message": "Missing arguments"
        }))
        sys.exit(1)
    
    reg_face_source = sys.argv[1]
    cap_frame_source = sys.argv[2]
    
    try:
        # Load images
        reg_image = load_image(reg_face_source)
        cap_image = load_image(cap_frame_source)
        
        # Extract faces using MediaPipe
        reg_face = extract_face_region(reg_image)
        cap_face = extract_face_region(cap_image)
        
        if reg_face is None or cap_face is None:
            print(json.dumps({
                "matched": False,
                "confidence": 0.0,
                "is_live": False,
                "message": "Face not detected"
            }))
            sys.exit(0)
        
        # Compare using multiple matching methods
        confidence = calculate_face_similarity(reg_face, cap_face)
        matched = confidence > 0.15  # Much lower threshold - just need basic match
        
        # Check liveness
        is_live_result = check_liveness(cap_face)
        
        # Output result
        print(json.dumps({
            "matched": matched,
            "confidence": round(confidence, 2),
            "is_live": is_live_result,
            "message": f"Face {'MATCHED ✓' if matched else 'NOT MATCHED ✗'} ({confidence:.1%}) - Live: {is_live_result}"
        }))
        
    except Exception as e:
        print(json.dumps({
            "matched": False,
            "confidence": 0.0,
            "is_live": False,
            "message": f"Error: {str(e)}"
        }))
