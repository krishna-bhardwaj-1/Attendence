const Student = require('../models/student');
const ClassAccess = require('../models/classAccess');
const MarkPresent = require('../models/markpresent');
const axios = require('axios');

// Flask recognition service endpoint (Python on 9000, Node.js on 8000)
const RECOGNITION_API = process.env.RECOGNITION_API || 'http://localhost:9000/recognize';

module.exports.getSignUp = async (req, res, next) => {
    res.render('../views/student/signup');
}

module.exports.postSignUp = async (req, res, next) => {
    try {
        const { rollNumber, name, email, phone, course, branch, year, semester } = req.body;
        
        // Check if file was uploaded
        if (!req.file) {
            console.error('[Signup] No file uploaded');
            return res.status(400).json({
                success: false,
                message: 'Please upload a photo'
            });
        }

        // Verify Cloudinary URL is valid
        if (!req.file.path || !req.file.path.includes('cloudinary.com')) {
            console.error('[Signup] Invalid Cloudinary URL:', req.file.path);
            return res.status(500).json({
                success: false,
                message: 'Image upload failed. Please try again.'
            });
        }

        console.log('[Signup] Photo uploaded successfully:', req.file.path);
        
        // Check if student already exists
        const existingStudent = await Student.findOne({ 
            $or: [
                { rollNumber: parseInt(rollNumber) },
                { email: email }
            ]
        });
        
        if (existingStudent) {
            return res.status(400).json({
                success: false,
                message: 'Student with this roll number or email already exists'
            });
        }
        
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
        
        return res.status(200).json({
            success: true,
            message: 'Registration successful! Redirecting to login...',
            redirectUrl: '/'
        });
        
    } catch (err) {
        console.error('[Signup] Error:', err);
        
        // Handle duplicate key error
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Student with this roll number or email already exists'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: `Registration failed: ${err.message}`
        });
    }
}

const sampleTimetable = {
    class1: {
        id: 'class1',
        timing: '10:00AM - 11:00 AM',
        subjectName: 'Machine Learning',
        roomNo: 'AB-I 405',
    },
    class2: {
        id: 'class2',
        timing: '11:00AM - 12:00 PM',
        subjectName: 'Database Manag System',
        roomNo: 'AB-I 201',
    },
    class3: {
        id: 'class3',
        timing: '12:00 - 01:00 PM',
        subjectName: 'Operating System',
        roomNo: 'AB-I 406',
    },
    class4: {
        id: 'class4',
        timing: '02:00PM - 03:00 PM',
        subjectName: 'Computer Networks',
        roomNo: 'AB-I 205',
    },
    class5: {
        id: 'class5',
        timing: '03:00 PM - 04:00 PM',
        subjectName: 'Software Engineering',
        roomNo: 'AB-III 102',
    },
    class6: {
        id: 'class6',
        timing: '04:00 PM - 05:00 PM',
        subjectName: 'ICP',
        roomNo: 'AB-XII 5046',
    }
};

module.exports.postPortal = async (req, res, next) => {
    try {
        const { rollNumber, name } = req.body;
        
        // Validate input
        if (!rollNumber || !name) {
            return res.status(400).json({
                success: false,
                message: 'Please enter both roll number and name'
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
        
        // If student not found, return error
        if (!student) {
            return res.status(401).json({
                success: false,
                message: 'Your given information is wrong. Check it again.'
            });
        }
        
        // Validate name
        const nameTrimmed = name.trim();
        const studentNameTrimmed = student.name.trim();
        
        if (studentNameTrimmed.toLowerCase() !== nameTrimmed.toLowerCase()) {
            return res.status(401).json({
                success: false,
                message: 'Your given information is wrong. Check it again.'
            });
        }
        
        // Credentials are correct - set session
        if (req.session) {
            req.session.studentId = student._id;
            req.session.rollNumber = student.rollNumber;
            req.session.studentName = student.name;
            req.session.studentLoggedIn = true;
        }

        res.json({
            success: true,
            message: 'Login successful',
            redirectUrl: '/student/portal'
        });
        
    } catch (error) {
        console.error('Error in postPortal:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again.'
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

        // Call Flask recognition service
        try {
            const response = await axios.post(RECOGNITION_API, {
                rollNumber: rollNumber.toString(),
                frame: frame
            }, {
                timeout: 15000 // 15 second timeout (increased for face detection)
            });
            
            const result = response.data;
            
            // Log results
            if (result.matched) {
                console.log('[Face Recognition] ✓ Match detected', {
                    confidence: (result.confidence * 100).toFixed(1) + '%',
                    isLive: result.isLive
                });
            } else {
                console.log('[Face Recognition] ✗ No match', {
                    confidence: (result.confidence * 100).toFixed(1) + '%',
                    isLive: result.isLive,
                    reason: result.message
                });
            }
            
            return res.json(result);
            
        } catch (error) {
            if (error.response) {
                // Flask API returned an error
                console.error('[Face Recognition] API error:', error.response.data);
                return res.json(error.response.data);
            } else if (error.code === 'ECONNREFUSED') {
                console.error('[Face Recognition] Cannot connect to Flask API at', RECOGNITION_API);
                return res.json({ 
                    success: false, 
                    matched: false, 
                    error: 'Recognition service unavailable' 
                });
            } else {
                console.error('[Face Recognition] Error:', error.message);
                return res.json({ 
                    success: false, 
                    matched: false, 
                    error: error.message 
                });
            }
        }

    } catch (error) {
        console.error('Face recognition error:', error);
        res.json({ success: false, matched: false });
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

// Logout function
module.exports.logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.json({
                    success: false,
                    message: 'Logout failed'
                });
            }
            
            // Clear cookies
            res.clearCookie('connect.sid');
            
            return res.json({
                success: true,
                message: 'Logged out successfully',
                redirectUrl: '/'
            });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.json({
            success: false,
            message: 'An error occurred during logout'
        });
    }
};