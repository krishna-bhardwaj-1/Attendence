const Student = require('../models/student');
const ClassAccess = require('../models/classAccess');
const MarkPresent = require('../models/markpresent');
const { spawn } = require('child_process');
const path = require('path');

// Allow configuring Python path via environment variable
// Prioritize conda environment Python for this project
const PYTHON_PATH = process.env.PYTHON_PATH || 
    '/opt/anaconda3/envs/project/bin/python3' ||
    (process.platform === 'darwin' ? '/Users/krishna/.pyenv/shims/python3' : 'python3') ||
    'python3';

module.exports.getSignUp = async (req, res, next) => {
    res.render('../views/student/signup');
}

module.exports.postSignUp = async (req, res, next) => {
    try {
        const { rollNumber, name, email, phone, course, branch, year, semester } = req.body;
        
        // Check if file was uploaded
        if (!req.file) {
            console.error('[Signup] No file uploaded');
            return res.status(400).send(`
                <script>
                    alert('Please upload a photo');
                    window.history.back();
                </script>
            `);
        }

        // Verify Cloudinary URL is valid
        if (!req.file.path || !req.file.path.includes('cloudinary.com')) {
            console.error('[Signup] Invalid Cloudinary URL:', req.file.path);
            return res.status(500).send(`
                <script>
                    alert('Image upload failed. Please try again.');
                    window.history.back();
                </script>
            `);
        }

        console.log('[Signup] Photo uploaded successfully:', req.file.path);
        
        await Student.create({
            photo: req.file.path,
            rollNumber: parseInt(rollNumber),
            name,
            email,
            phone,
            course,
            branch,
            year,
            semester
        });
        
        console.log('[Signup] Student registered successfully');
        res.redirect('/');
        
    } catch (err) {
        console.error('[Signup] Error:', err);
        res.status(500).send(`
            <script>
                alert('Registration failed: ${err.message}');
                window.history.back();
            </script>
        `);
    }
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
    try {
        const { rollNumber, name } = req.body;
        
        if (!rollNumber || !name) {
            return res.render('../views/student/login', {
                error: 'Please enter both roll number and name'
            });
        }
        
        let student = await Student.findOne({ rollNumber: parseInt(rollNumber) });
        
        if (!student) {
            student = await Student.findOne({ rollNumber: String(rollNumber) });
        }
        
        if (!student) {
            student = await Student.findOne({ 
                $or: [
                    { rollNumber: parseInt(rollNumber) },
                    { rollNumber: String(rollNumber) }
                ]
            });
        }
        
        if (!student) {
            return res.render('../views/index', {
                error: `Student with roll number ${rollNumber} not found. Please check your credentials.`
            });
        }
        
        const nameTrimmed = name.trim();
        const studentNameTrimmed = student.name.trim();
        
        if (studentNameTrimmed.toLowerCase() !== nameTrimmed.toLowerCase()) {
            return res.render('../views/student/login', {
                error: `Name does not match. Expected: "${studentNameTrimmed}"`
            });
        }
        
        if (req.session) {
            req.session.studentId = student._id;
            req.session.rollNumber = student.rollNumber;
            req.session.studentName = student.name;
            req.session.studentLoggedIn = true;
        }

        res.render('../views/student/portal', { 
            student, 
            timetable: sampleTimetable 
        });
        
    } catch (error) {
        console.error('Error in postPortal:', error);
        res.render('../views/student/login', {
            error: 'An error occurred. Please try again.'
        });
    }
}

module.exports.getPortal = async (req, res, next) => {
    try {
        if (!req.session || !req.session.studentLoggedIn || !req.session.studentId) {
            return res.redirect('/');
        }
        
        const student = await Student.findById(req.session.studentId);
        
        if (!student) {
            req.session.destroy();
            return res.redirect('/');
        }
        
        res.render('../views/student/portal', { 
            student, 
            timetable: sampleTimetable 
        });
        
    } catch (error) {
        console.error('Error in getPortal:', error);
        res.redirect('/');
    }
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
// NEW: Recognize single frame
module.exports.recognizeFrame = async (req, res) => {
    try {
        const { rollNumber, frame } = req.body;
        
        if (!rollNumber || !frame) {
            return res.json({ faceDetected: false });
        }

        // Find student
        const student = await Student.findOne({ rollNumber: parseInt(rollNumber) });
        if (!student || !student.photo) {
            return res.json({ faceDetected: false });
        }

        // Call Python with frame data - Add timeout to prevent hanging
        const python = spawn(PYTHON_PATH, [
            '-W', 'ignore::UserWarning',
            path.join(__dirname, '../ml/compare_frame.py'),
            student.photo,
            frame
        ]);

        let result = '';
        let hasResponded = false;
        
        // Set timeout for Python process (12 seconds max - increased for slower processing)
        const processTimeout = setTimeout(() => {
            if (!hasResponded) {
                hasResponded = true;
                python.kill('SIGKILL');
                console.error('[Frame Recognition] Python process timeout - killing process');
                res.json({ faceDetected: false, error: 'Process timeout' });
            }
        }, 12000);

        python.stdout.on('data', (data) => {
            result += data.toString();
        });

        // Suppress stderr warnings (only log real errors)
        python.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            // Only log if it's not the pkg_resources warning
            if (!errorMsg.includes('pkg_resources is deprecated')) {
                console.error('[Python stderr]', errorMsg);
            }
        });

        python.on('close', (code) => {
            if (hasResponded) return;
            hasResponded = true;
            clearTimeout(processTimeout);
            
            // Log non-zero exit codes
            if (code !== 0) {
                console.error(`[Frame Recognition] Python exited with code ${code}`);
                console.error(`[Frame Recognition] Output: ${result.substring(0, 200)}`);
            }
            
            try {
                const rawOutput = result.trim().split('\n').pop();
                if (!rawOutput) {
                    console.error('[Frame Recognition] No output from Python script');
                    res.json({ faceDetected: false, error: 'No output' });
                    return;
                }
                const parsed = JSON.parse(rawOutput);
                // Only log successful matches to reduce console spam
                if (parsed.matched) {
                    console.log('[Frame Recognition] Match:', parsed.confidence.toFixed(3));
                } else if (parsed.error) {
                    console.error('[Frame Recognition] Python error:', parsed.error);
                }
                res.json(parsed);
            } catch (e) {
                console.error('[Frame Recognition Parse Error]', e.message);
                console.error('[Frame Recognition] Raw output:', result.substring(0, 500));
                res.json({ faceDetected: false, error: 'Parse error' });
            }
        });

        python.on('error', (error) => {
            if (hasResponded) return;
            hasResponded = true;
            clearTimeout(processTimeout);
            console.error('[Frame Recognition] Python spawn error:', error.message);
            console.error('[Frame Recognition] Python path:', PYTHON_PATH);
            console.error('[Frame Recognition] Student photo URL:', student.photo);
            res.json({ faceDetected: false, error: 'Process error: ' + error.message });
        });

    } catch (error) {
        console.error('Frame recognition error:', error);
        res.json({ faceDetected: false });
    }
};

// NEW: Save attendance after recognition
module.exports.saveAttendance = async (req, res) => {
    try {
        const { rollNumber, confidence, subject, time, room } = req.body;

        if (!subject || !time || !room) {
            return res.json({ success: false, message: 'Class information missing' });
        }

        const student = await Student.findOne({ rollNumber: parseInt(rollNumber) });
        if (!student) {
            return res.json({ success: false, message: 'Student not found' });
        }

        // Check if already marked for THIS SPECIFIC CLASS today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existing = await MarkPresent.findOne({
            rollNumber: parseInt(rollNumber),
            subject: subject,
            time: time,
            room: room,
            timestamp: { $gte: today }
        });

        if (existing) {
            return res.json({ success: false, message: `Already marked attendance for ${subject} today` });
        }

        // Save attendance with class information
        await MarkPresent.create({
            rollNumber: parseInt(rollNumber),
            studentName: student.name,
            timestamp: new Date(),
            method: 'face_recognition',
            confidence: confidence,
            status: 'present',
            framesProcessed: 0,
            subject: subject,
            time: time,
            room: room
        });

        res.json({
            success: true,
            message: `Student: ${student.name}\nRoll No: ${rollNumber}\nSubject: ${subject}\nConfidence: ${(confidence * 100).toFixed(1)}%\nTime: ${new Date().toLocaleTimeString()}`
        });

    } catch (error) {
        console.error('Save attendance error:', error);
        res.json({ success: false, message: error.message });
    }
};

// Get recent attendance records for student
module.exports.getRecentAttendance = async (req, res) => {
    try {
        const { rollNumber } = req.query;
        
        if (!rollNumber) {
            return res.json({
                success: false,
                message: 'Roll number required',
                attendance: []
            });
        }

        // Get recent attendance records (last 10) for this student
        const attendance = await MarkPresent.find({
            rollNumber: parseInt(rollNumber)
        })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean();

        res.json({
            success: true,
            attendance: attendance
        });

    } catch (error) {
        console.error('Get recent attendance error:', error);
        res.json({
            success: false,
            message: error.message,
            attendance: []
        });
    }
};