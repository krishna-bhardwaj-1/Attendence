const Student = require('../models/student');
const ClassAccess = require('../models/classAccess');
const MarkPresent = require('../models/markpresent');
const { PythonShell } = require('python-shell');
const path = require('path');

module.exports.getSignUp = async (req, res, next) => {
    res.render('../views/student/signup');
}

module.exports.postSignUp = async (req, res, next) => {
    try {
        const { rollNumber, name, email, phone, course, branch, year, semester } = req.body;
        await Student.create({
            photo: req.file.path,
            rollNumber,
            name,
            email,
            phone,
            course,
            branch,
            year,
            semester
        });
    } catch (err) {
        console.log(err);
    }
    res.redirect('/');
}

const sampleTimetable = {
    class1: {
        id: 'class1',
        timing: '10:00AM - 11:00 AM',
        subjectName: 'Machine Learning',
        roomNo: 'Academic Block-I 405',
    },
    class2: {
        id: 'class2',
        timing: '11:00AM - 12:00 PM',
        subjectName: 'Database Manag System',
        roomNo: 'Academic Block-I 201',
    },
    class3: {
        id: 'class3',
        timing: '12:00 - 01:00 PM',
        subjectName: 'Operating System',
        roomNo: 'Academic Block-I 406',
    },
    class4: {
        id: 'class4',
        timing: '02:00PM - 03:00 PM',
        subjectName: 'Computer Networks',
        roomNo: 'Academic Block-I 205',
    },
    class5: {
        id: 'class5',
        timing: '03:00 PM - 04:00 PM',
        subjectName: 'Software Engineering',
        roomNo: 'Academic Block-III 102',
    },
    class6: {
        id: 'class6',
        timing: '04:00 PM - 05:00 PM',
        subjectName: 'Mini Project',
        roomNo: 'Academic Block-XI CSED',
    }
};

module.exports.postPortal = async (req, res, next) => {
    const { rollNumber, name } = req.body;
    const student = await Student.findOne({ rollNumber, name });
    if (!student) {
        return res.redirect('/');
    }
    
    if (req.session) {
        req.session.studentId = student._id;
        req.session.rollNumber = student.rollNumber;
        req.session.studentName = student.name;
    }
    
    res.render('../views/student/portal', { student, timetable: sampleTimetable });
}

module.exports.checkAccess = async (req, res, next) => {
    try {
        const { subject, time, room } = req.query;

        if (!subject || !time || !room) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters'
            });
        }

        const classAccess = await ClassAccess.findOne({ subject, time, room });

        if (!classAccess) {
            return res.json({
                success: true,
                accessGranted: false,
                message: 'No access record found'
            });
        }

        res.json({
            success: true,
            accessGranted: classAccess.accessGranted,
            grantedAt: classAccess.grantedAt,
            message: classAccess.accessGranted ? 'Access granted' : 'Access not granted'
        });

    } catch (error) {
        console.error('Error in checkAccess:', error);
    }
}

module.exports.showFaceDetection = async (req, res, next) => {
    try {
        res.render('../views/student/face-detection', { 
            rollNumber: req.query.rollNumber,
            subject: req.query.subject,
            time: req.query.time,
            room: req.query.room
        });
    } catch (error) {
        console.error('Error showing face detection:', error);
        res.status(500).send('Error loading face detection window');
    }
}

// MAIN FACE RECOGNITION ENDPOINT
module.exports.getMarkAttendenceFace = async (req, res, next) => {
    try {
        const rollNumber = req.query.rollNumber || req.body.rollNumber;
        
        if (!rollNumber) {
            console.error('[Face Recognition] No roll number provided');
            return res.status(400).send(`
                <script>
                    alert('Roll number is required');
                    window.history.back();
                </script>
            `);
        }

        console.log(`\n========================================`);
        console.log(`[Face Recognition] Starting for roll number: ${rollNumber}`);
        console.log(`========================================\n`);

        // Find student in database
        const student = await Student.findOne({ rollNumber: parseInt(rollNumber) });
        
        if (!student) {
            console.error('[Face Recognition] Student not found in database');
            return res.status(404).send(`
                <script>
                    alert('Student not found in database');
                    window.history.back();
                </script>
            `);
        }

        if (!student.photo) {
            console.error('[Face Recognition] No photo registered for student');
            return res.status(400).send(`
                <script>
                    alert('No photo registered. Please contact admin to upload your photo.');
                    window.history.back();
                </script>
            `);
        }

        console.log(`[Face Recognition] Student: ${student.name}`);
        console.log(`[Face Recognition] Photo URL: ${student.photo}`);

        // Python script configuration
        const options = {
            mode: 'json',
            pythonPath: '/opt/anaconda3/envs/project/bin/python3',
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname, '../ml'),
            args: [
                student.photo,
                rollNumber.toString(),
                '30'  // 30 seconds timeout
            ]
        };

        console.log(`[Face Recognition] Python Path: ${options.pythonPath}`);
        console.log(`[Face Recognition] Script Path: ${options.scriptPath}`);
        console.log(`[Face Recognition] Starting Python script...\n`);

        // Run Python script
        PythonShell.run('student_face_recognition.py', options, async (err, results) => {
            if (err) {
                console.error('[Face Recognition] ✗ Python Script Error:', err);
                return res.status(500).send(`
                    <script>
                        alert('Face recognition failed: ${err.message.replace(/'/g, "\\'")}\\n\\nPlease ensure:\\n1. Camera is connected and not in use\\n2. Python dependencies are installed\\n3. Good lighting is available');
                        window.history.back();
                    </script>
                `);
            }

            if (!results || results.length === 0) {
                console.error('[Face Recognition] ✗ No output from Python script');
                return res.status(500).send(`
                    <script>
                        alert('No response from face recognition system');
                        window.history.back();
                    </script>
                `);
            }

            const result = results[0];
            console.log('\n[Face Recognition] Result received:');
            console.log(JSON.stringify(result, null, 2));

            if (result.success && result.recognized) {
                // Face recognized successfully
                console.log(`\n[Face Recognition] ✓ FACE RECOGNIZED`);
                console.log(`[Face Recognition] Confidence: ${(result.confidence * 100).toFixed(1)}%`);
                console.log(`[Face Recognition] Frames processed: ${result.frames_processed}`);
                
                try {
                    // Save attendance to database
                    const attendanceRecord = await MarkPresent.create({
                        rollNumber: parseInt(rollNumber),
                        studentName: student.name,
                        timestamp: new Date(),
                        method: 'face_recognition',
                        confidence: result.confidence,
                        status: 'present',
                        framesProcessed: result.frames_processed || 0
                    });

                    console.log(`[Face Recognition] ✓ Attendance saved to database`);
                    console.log(`[Face Recognition] Record ID: ${attendanceRecord._id}`);
                    console.log(`========================================\n`);
                    
                    return res.status(200).send(`
                        <script>
                            alert('✓ Attendance Marked Successfully!\\n\\nStudent: ${student.name}\\nRoll No: ${rollNumber}\\nConfidence: ${(result.confidence * 100).toFixed(1)}%\\nFrames Processed: ${result.frames_processed}\\nTime: ${new Date().toLocaleTimeString()}');
                            window.location.href = '/student/portal';
                        </script>
                    `);
                    
                } catch (dbError) {
                    console.error('[Face Recognition] ✗ Database Error:', dbError);
                    return res.status(500).send(`
                        <script>
                            alert('Face recognized but failed to save attendance:\\n${dbError.message.replace(/'/g, "\\'")}');
                            window.history.back();
                        </script>
                    `);
                }
                
            } else {
                // Face not recognized
                console.log(`\n[Face Recognition] ✗ FACE NOT RECOGNIZED`);
                console.log(`[Face Recognition] Best confidence: ${(result.confidence * 100).toFixed(1)}%`);
                console.log(`[Face Recognition] Frames checked: ${result.frames_processed}`);
                console.log(`[Face Recognition] Message: ${result.message}`);
                console.log(`========================================\n`);
                
                return res.status(200).send(`
                    <script>
                        alert('✗ Face Not Recognized\\n\\n${result.message}\\n\\nBest Confidence: ${(result.confidence * 100).toFixed(1)}%\\nFrames Checked: ${result.frames_processed || 0}\\n\\nTips:\\n• Ensure good lighting\\n• Look directly at camera\\n• Remove glasses if wearing\\n• Stay still during recognition\\n• Try again');
                        window.history.back();
                    </script>
                `);
            }
        });

    } catch (error) {
        console.error('[Face Recognition] ✗ Controller Error:', error);
        return res.status(500).send(`
            <script>
                alert('Server error occurred:\\n${error.message.replace(/'/g, "\\'")}\\n\\nPlease try again or contact support.');
                window.history.back();
            </script>
        `);
    }
};