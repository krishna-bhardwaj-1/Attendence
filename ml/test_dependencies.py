#!/usr/bin/env python3
import sys
print("Testing Python dependencies...")

try:
    import cv2
    print("✓ OpenCV installed:", cv2.__version__)
except ImportError:
    print("✗ OpenCV not installed - run: pip install opencv-python")
    sys.exit(1)

try:
    import face_recognition
    print("✓ face_recognition installed")
except ImportError:
    print("✗ face_recognition not installed - run: pip install face-recognition")
    sys.exit(1)

try:
    import numpy
    print("✓ NumPy installed:", numpy.__version__)
except ImportError:
    print("✗ NumPy not installed - run: pip install numpy")
    sys.exit(1)

try:
    import requests
    print("✓ Requests installed:", requests.__version__)
except ImportError:
    print("✗ Requests not installed - run: pip install requests")
    sys.exit(1)

print("\n✓ All dependencies installed successfully!")