// faceRecognition.js - Place in /public/js/

class FaceRecognitionHandler {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.stream = null;
        this.isRecognizing = false;
        this.matchCount = 0;
        this.requiredMatches = 2; // Reduced to 2 for faster recognition (was 3)
        this.recognitionTimeout = 30; // seconds - increased slightly
        this.intervalId = null;
        this.timeoutId = null;
    }

    initialize(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        console.log('[Face Recognition] Initialized');
    }

    async startCamera() {
        try {
            console.log('[Face Recognition] Starting camera...');
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640, max: 640 },
                    height: { ideal: 480, max: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 24, max: 24 } // Reduced frame rate for smoother performance
                },
                audio: false
            });

            this.video.srcObject = this.stream;
            
            // Set video properties for smooth playback
            this.video.playsInline = true;
            this.video.muted = true;
            this.video.setAttribute('playsinline', '');
            this.video.setAttribute('autoplay', '');
            this.video.setAttribute('muted', '');
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(() => {
                        console.log('[Face Recognition] Camera started successfully');
                        resolve();
                    }).catch((err) => {
                        console.error('[Face Recognition] Video play error:', err);
                        resolve(); // Continue anyway
                    });
                };
            });

            return true;

        } catch (error) {
            console.error('[Face Recognition] Camera error:', error);
            alert('Camera access denied. Please allow camera access and try again.');
            return false;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            console.log('[Face Recognition] Camera stopped');
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        this.isRecognizing = false;
    }

    captureFrame() {
        const ctx = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        ctx.drawImage(this.video, 0, 0);
        
        // Get base64 image with lower quality for faster processing
        return this.canvas.toDataURL('image/jpeg', 0.3);
    }

    drawFaceBoundary(result) {
        if (!result.faceDetected) {
            // Clear canvas if no face detected
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        const ctx = this.canvas.getContext('2d');
        const scaleX = this.canvas.width / this.video.videoWidth;
        const scaleY = this.canvas.height / this.video.videoHeight;

        const x = result.x * scaleX;
        const y = result.y * scaleY;
        const width = result.width * scaleX;
        const height = result.height * scaleY;

        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            // Clear previous drawings
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Set style based on match
            const color = result.matched ? '#00ff00' : '#ff0000';
            const lineWidth = result.matched ? 4 : 3;

            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = 'round';

            // Draw main rectangle
            ctx.strokeRect(x, y, width, height);

            // Draw corner markers (simplified for performance)
            const markerLength = 20;
            ctx.beginPath();
            
            // Top-left
            ctx.moveTo(x, y + markerLength);
            ctx.lineTo(x, y);
            ctx.lineTo(x + markerLength, y);
            
            // Top-right
            ctx.moveTo(x + width - markerLength, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + markerLength);
            
            // Bottom-left
            ctx.moveTo(x, y + height - markerLength);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x + markerLength, y + height);
            
            // Bottom-right
            ctx.moveTo(x + width - markerLength, y + height);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x + width, y + height - markerLength);
            
            ctx.stroke();

            // Draw confidence label (simplified)
            const confidence = Math.round(result.confidence * 100);
            const label = `${confidence}% ${result.matched ? '✓' : '✗'}`;

            ctx.fillStyle = color;
            ctx.fillRect(x, y - 30, 120, 25);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(label, x + 5, y - 10);

            // Draw match counter if matching
            if (result.matched) {
                ctx.fillStyle = '#00ff00';
                ctx.font = 'bold 11px Arial';
                ctx.fillText(`${this.matchCount}/${this.requiredMatches}`, x + 5, y + height + 18);
            }
        });
    }

    async startRecognition(rollNumber, progressCallback, completeCallback) {
        this.isRecognizing = true;
        this.matchCount = 0;
        let timeLeft = this.recognitionTimeout;
        let frameCount = 0;
        let bestConfidence = 0;

        console.log(`[Face Recognition] Starting recognition process... Required matches: ${this.requiredMatches}`);

        // Update timer
        const timerInterval = setInterval(() => {
            timeLeft--;
            progressCallback({
                timeLeft: timeLeft,
                matchCount: this.matchCount
            });

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
            }
        }, 1000);

        // Recognition loop - Process less frequently to reduce system load and improve video smoothness
        let isProcessing = false; // Prevent concurrent requests
        let lastProcessTime = 0;
        const PROCESS_INTERVAL = 2000; // Process every 2 seconds for smoother video and less CPU load
        
        const processFrame = async () => {
            if (!this.isRecognizing) {
                return;
            }

            const now = Date.now();
            // Skip if already processing or too soon since last process
            if (isProcessing || (now - lastProcessTime) < PROCESS_INTERVAL) {
                requestAnimationFrame(processFrame);
                return;
            }

            lastProcessTime = now;
            frameCount++;
            isProcessing = true;

            // Capture frame
            const frameData = this.captureFrame();

            try {
                // Send frame to backend for recognition with longer timeout to prevent frequent timeouts
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per request
                
                const response = await fetch('/student/recognize-frame', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        rollNumber: rollNumber,
                        frame: frameData
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const result = await response.json();
                
                // Debug: Log the full result to see what we're getting
                console.log('[Face Recognition] Full response:', JSON.stringify(result, null, 2));
                console.log('[Face Recognition] Response details:', {
                    faceDetected: result.faceDetected,
                    matched: result.matched,
                    confidence: result.confidence,
                    error: result.error,
                    currentMatchCount: this.matchCount,
                    requiredMatches: this.requiredMatches
                });

                // Handle timeout errors - don't reset match count
                if (result.error === 'Process timeout') {
                    console.log(`[Face Recognition] Timeout occurred, but preserving match count: ${this.matchCount}/${this.requiredMatches}`);
                    // Don't reset - just continue
                } else if (result.faceDetected) {
                    // Draw face boundary
                    this.drawFaceBoundary(result);

                    if (result.confidence > bestConfidence) {
                        bestConfidence = result.confidence;
                    }

                    if (result.matched) {
                        // Count matches with moderate confidence (0.5 = 50%)
                        if (result.confidence >= 0.5) {
                            const previousCount = this.matchCount;
                            this.matchCount++;
                            
                            console.log(`[Face Recognition] ✓ Match detected! Count: ${previousCount} -> ${this.matchCount}/${this.requiredMatches} - Confidence: ${(result.confidence * 100).toFixed(1)}%`);
                            
                            // Update UI immediately
                            progressCallback({
                                timeLeft: timeLeft,
                                matchCount: this.matchCount
                            });
                            
                            console.log(`[Face Recognition] Progress callback called with matchCount: ${this.matchCount}`);

                            // Check if recognition complete
                            if (this.matchCount >= this.requiredMatches) {
                                clearInterval(timerInterval);
                                this.isRecognizing = false;

                                console.log(`[Face Recognition] ✅ Recognition complete! Total matches: ${this.matchCount}, Best confidence: ${(bestConfidence * 100).toFixed(1)}%`);
                                completeCallback({
                                    success: true,
                                    confidence: bestConfidence,
                                    message: 'Face recognized successfully'
                                });
                                return;
                            }
                        } else {
                            console.log(`[Face Recognition] Low confidence: ${(result.confidence * 100).toFixed(1)}% (not counting)`);
                        }
                        // Don't reset on low confidence - just don't count it
                    } else {
                        // Only reset counter if confidence is very low (not just no match)
                        // This prevents reset on temporary detection issues
                        if (result.confidence && result.confidence < 0.3) {
                            this.matchCount = Math.max(0, this.matchCount - 1); // Decrement instead of reset
                            console.log(`[Face Recognition] Very low confidence, decrementing match count to: ${this.matchCount}`);
                        } else {
                            console.log(`[Face Recognition] No match (confidence: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}), preserving match count: ${this.matchCount}`);
                        }
                    }
                } else {
                    // Don't reset match count on face detection failure - might be temporary
                    // Only clear canvas
                    console.log(`[Face Recognition] No face detected, preserving match count: ${this.matchCount}/${this.requiredMatches}`);
                    const ctx = this.canvas.getContext('2d');
                    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                }

            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('[Face Recognition] Frame processing error:', error);
                }
                // Don't reset match count on errors - preserve progress
            } finally {
                isProcessing = false;
                // Continue processing with requestAnimationFrame for smooth video
                if (this.isRecognizing) {
                    requestAnimationFrame(processFrame);
                }
            }
        };

        // Start processing loop
        requestAnimationFrame(processFrame);

        // Overall timeout
        this.timeoutId = setTimeout(() => {
            if (this.isRecognizing) {
                clearInterval(timerInterval);
                this.isRecognizing = false;

                console.log('[Face Recognition] Recognition timeout');
                completeCallback({
                    success: false,
                    confidence: bestConfidence,
                    message: `Face not recognized. Best confidence: ${(bestConfidence * 100).toFixed(1)}%`
                });
            }
        }, this.recognitionTimeout * 1000);
    }
}

// Make it globally available
window.FaceRecognitionHandler = FaceRecognitionHandler;