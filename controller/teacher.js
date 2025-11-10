const Teacher = require('../models/teacher');
const ClassAccess = require('../models/classAccess');
const MarkPresent = require('../models/markpresent');
const path = require('path');
const { PythonShell } = require('python-shell');
const Student = require('../models/student');
const { sendOTP, verifyOTP } = require('../utils/otpService');

module.exports.getRegister = async (req, res, next) => {
    res.render('../views/teacher/register');
}

module.exports.postRegister = async (req, res, next) => {
    const { teacherId, name, email, phone, password, department, designation } = req.body;
    await Teacher.create({
        teacherId,
        name,
        email,
        phone,
        password,
        department,
        designation
    });
    res.redirect('/');
}

const sampleTimetable = {
    class1: {
        timing: '10:00AM - 11:00 AM',
        subjectName: 'Machine Learning',
        roomNo: 'Academic Block-I 405'
    },
    class2: {
        timing: '11:00AM - 12:00 PM',
        subjectName: 'Database Manag System',
        roomNo: 'Academic Block-I 201'
    },
    class3: {
        timing: '12:00 - 01:00 PM',
        subjectName: 'Operating System',
        roomNo: 'Academic Block-I 406'
    },
    class4: {
        timing: '02:00PM - 03:00 PM',
        subjectName: 'Computer Networks',
        roomNo: 'Academic Block-I 205'
    },
    class5: {
        timing: '03:00 PM - 04:00 PM',
        subjectName: 'Software Engineering',
        roomNo: 'Academic Block-III 102'
    },
    class6: {
        timing: '04:00 PM - 05:00 PM',
        subjectName: 'Mini Project',
        roomNo: 'Academic Block-XI CSED'
    }
};

// Step 1: Verify credentials and send OTP
module.exports.postPortal = async (req, res, next) => {
    try {
        const { teacherId, password } = req.body;
        
        console.log('Teacher login attempt:', { teacherId });
        
        if (!teacherId || !password) {
            console.log('Missing credentials');
            return res.json({
                success: false,
                message: 'Please enter both teacher ID and password'
            });
        }
        
        const teacher = await Teacher.findOne({ 
            teacherId: teacherId, 
            password: password 
        });
        
        if (!teacher) {
            console.log('Teacher not found or wrong password');
            return res.json({
                success: false,
                message: 'Invalid credentials. Please check your teacher ID and password.'
            });
        }
        
        console.log('Teacher found:', teacher.name);
        
        // Normalize email address (fix double @ symbols if present)
        let teacherEmail = teacher.email;
        if (teacherEmail && teacherEmail.includes('@@')) {
            console.warn(`[Teacher Login] Detected double @ in email: ${teacherEmail}`);
            teacherEmail = teacherEmail.replace(/@@+/g, '@');
            console.log(`[Teacher Login] Normalized email to: ${teacherEmail}`);
        }
        
        // Store teacher info in session for OTP verification (use normalized email)
        if (req.session) {
            req.session.teacherId = teacher._id;
            req.session.teacherIdNum = teacher.teacherId;
            req.session.teacherName = teacher.name;
            req.session.teacherEmail = teacherEmail; // Store normalized email
        }
        
        // Send OTP to teacher's email
        console.log(`[Teacher Login] Attempting to send OTP to: ${teacherEmail}`);
        const otpResult = await sendOTP(teacherEmail, teacher.name);
        
        console.log(`[Teacher Login] OTP send result:`, {
            success: otpResult.success,
            message: otpResult.message
        });
        
        if (!otpResult.success) {
            console.error(`[Teacher Login] Failed to send OTP:`, otpResult.message);
            return res.json({
                success: false,
                message: otpResult.message || 'Failed to send OTP. Please try again.'
            });
        }
        
        // Mask email for display (show only first 3 chars and domain)
        const emailParts = teacher.email.split('@');
        const maskedEmail = emailParts[0].substring(0, 3) + '***@' + emailParts[1];
        
        res.json({
            success: true,
            message: 'OTP sent to your email. Please check your inbox.',
            email: maskedEmail
        });
        
    } catch (error) {
        console.error('Error in teacher postPortal:', error);
        res.json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};

// Step 2: Verify OTP and login
module.exports.verifyOTP = async (req, res, next) => {
    try {
        const { otp } = req.body;
        
        if (!otp) {
            return res.json({
                success: false,
                message: 'Please enter the OTP'
            });
        }
        
        // Get teacher email from session
        const teacherEmail = req.session?.teacherEmail;
        
        if (!teacherEmail) {
            return res.json({
                success: false,
                message: 'Session expired. Please login again.'
            });
        }
        
        // Verify OTP
        const verificationResult = verifyOTP(teacherEmail, otp);
        
        if (!verificationResult.success) {
            return res.json({
                success: false,
                message: verificationResult.message
            });
        }
        
        // OTP verified - mark as logged in
        if (req.session) {
            req.session.teacherLoggedIn = true;
        }
        
        // Return success - frontend will redirect to /teacher/portal
        res.json({
            success: true,
            message: 'OTP verified successfully'
        });
        
    } catch (error) {
        console.error('Error in OTP verification:', error);
        res.json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};

// GET portal route - render portal for logged-in teachers
module.exports.getPortal = async (req, res, next) => {
    try {
        // Check if teacher is logged in via session
        if (!req.session || !req.session.teacherLoggedIn || !req.session.teacherId) {
            return res.redirect('/');
        }
        
        // Get teacher from database
        const teacher = await Teacher.findById(req.session.teacherId);
        
        if (!teacher) {
            // Clear invalid session
            req.session.destroy();
            return res.redirect('/');
        }
        
        // Render teacher portal
        res.render('../views/teacher/portal', { 
            teacher, 
            timetable: sampleTimetable 
        });
        
    } catch (error) {
        console.error('Error in getPortal:', error);
        res.redirect('/');
    }
};

module.exports.grantAccess = async (req, res, next) => {
    try {
        const { subject, time, room, accessGranted, teacherId } = req.body;

        if (!subject || !time || !room || !teacherId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        console.log(`[Access Control] ${accessGranted ? 'Granting' : 'Revoking'} access for ${subject}`);

        let classAccess = await ClassAccess.findOne({ subject, time, room });

        if (classAccess) {
            classAccess.accessGranted = accessGranted;
            classAccess.teacherId = teacherId;
            
            if (accessGranted) {
                classAccess.grantedAt = new Date();
                classAccess.revokedAt = null;
            } else {
                classAccess.revokedAt = new Date();
            }
            
            await classAccess.save();
            console.log(`[Access Control] Updated existing record`);
        } else {
            classAccess = await ClassAccess.create({
                subject,
                time,
                room,
                accessGranted,
                teacherId,
                grantedAt: accessGranted ? new Date() : null,
                revokedAt: accessGranted ? null : new Date()
            });
            console.log(`[Access Control] Created new record`);
        }

        res.json({
            success: true,
            message: accessGranted ? 'Access granted successfully' : 'Access revoked successfully',
            data: classAccess
        });

    } catch (error) {
        console.error('Error in grantAccess:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

module.exports.checkAccessStatus = async (req, res) => {
    try {
        const { subject, time, room } = req.query;
        
        const classAccess = await ClassAccess.findOne({ subject, time, room });
        
        res.json({
            success: true,
            accessGranted: classAccess ? classAccess.accessGranted : false
        });
    } catch (error) {
        console.error('Error checking access:', error);
        res.json({ success: false, message: error.message });
    }
};

// NEW FUNCTION - Get attendance records for teacher portal display
module.exports.getAttendanceRecords = async (req, res) => {
    try {
        const { subject, time, room } = req.query;
        
        if (!subject || !time || !room) {
            return res.json({
                success: false,
                message: 'Missing parameters',
                attendance: [],
                count: 0
            });
        }

        // Get today's attendance FOR THIS SPECIFIC CLASS
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendance = await MarkPresent.find({
            subject: subject,
            time: time,
            room: room,
            timestamp: { $gte: today }
        }).sort({ timestamp: -1 }).lean();

        // Get total student count from database
        const totalStudents = await Student.countDocuments();

        // Only log when there are records to reduce console spam
        if (attendance.length > 0) {
            console.log(`[Attendance] ${subject}: ${attendance.length} students present`);
        }

        res.json({
            success: true,
            attendance: attendance,
            count: attendance.length,
            totalStudents: totalStudents
        });

    } catch (error) {
        console.error('[Attendance Records] Error:', error);
        res.json({
            success: false,
            message: error.message,
            attendance: [],
            count: 0,
            totalStudents: 0
        });
    }
};

// Face recognition endpoint (for manual face recognition if needed)
module.exports.getAttendance = async (req, res, next) => {
    try {
        // Get rollNumber safely
        let rollNumber = null;
        
        if (req.query && req.query.rollNumber) {
            rollNumber = req.query.rollNumber;
        } else if (req.body && req.body.rollNumber) {
            rollNumber = req.body.rollNumber;
        } else if (req.session && req.session.student && req.session.student.rollNumber) {
            rollNumber = req.session.student.rollNumber;
        }
        
        if (!rollNumber) {
            console.log('[Face Recognition] ⚠️ No roll number provided - ignoring request');
            return res.status(200).json({ 
                success: false, 
                message: 'Roll number required' 
            });
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[Face Recognition] Starting for roll number: ${rollNumber}`);
        console.log(`${'='.repeat(60)}\n`);

        const student = await Student.findOne({ rollNumber: parseInt(rollNumber) });
        
        if (!student) {
            console.error('[Face Recognition] Student not found');
            return res.status(404).send(`
                <script>
                    alert('Student not found');
                    window.history.back();
                </script>
            `);
        }

        if (!student.photo) {
            console.error('[Face Recognition] No photo registered');
            return res.status(400).send(`
                <script>
                    alert('No photo registered. Please upload photo first.');
                    window.history.back();
                </script>
            `);
        }

        console.log(`[Face Recognition] Student: ${student.name}`);
        console.log(`[Face Recognition] Photo URL: ${student.photo}`);
        
        if (!student.photo.includes('cloudinary.com')) {
            console.error('[Face Recognition] Invalid photo URL');
            return res.status(400).send(`
                <script>
                    alert('Invalid photo URL. Please re-upload.');
                    window.history.back();
                </script>
            `);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingAttendance = await MarkPresent.findOne({
            rollNumber: parseInt(rollNumber),
            timestamp: { $gte: today }
        });

        if (existingAttendance) {
            console.log('[Face Recognition] ⚠️ Already marked present');
            return res.status(200).send(`
                <script>
                    alert('Already marked present today!');
                    window.location.href = '/student/portal';
                </script>
            `);
        }

        const options = {
            mode: 'text',
            pythonPath: '/opt/anaconda3/envs/project/bin/python3',
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname, '../ml'),
            args: [
                student.photo,
                rollNumber.toString(),
                '60'
            ]
        };

        console.log(`[Face Recognition] Starting Python script...`);

        PythonShell.run('student_face_recognition.py', options, async (err, results) => {
            if (err) {
                console.error('[Face Recognition] ✗ Error:', err.message);
                
                let errorMessage = 'Face recognition failed';
                if (err.message.includes('404')) {
                    errorMessage = 'Photo not found (404). Please re-upload your photo.';
                } else if (err.message.includes('Camera')) {
                    errorMessage = 'Camera error. Please check camera access.';
                }
                
                return res.status(500).send(`
                    <script>
                        alert('${errorMessage}');
                        window.history.back();
                    </script>
                `);
            }

            if (!results || results.length === 0) {
                console.error('[Face Recognition] ✗ No output');
                return res.status(500).send(`
                    <script>
                        alert('No response from face recognition');
                        window.history.back();
                    </script>
                `);
            }

            try {
                let jsonResult = null;
                for (let line of results) {
                    line = line.trim();
                    if (line.startsWith('{') && line.endsWith('}')) {
                        try {
                            jsonResult = JSON.parse(line);
                            break;
                        } catch (e) {
                            continue;
                        }
                    }
                }

                if (!jsonResult) {
                    console.error('[Face Recognition] ✗ Could not parse JSON');
                    return res.status(500).send(`
                        <script>
                            alert('Failed to parse result');
                            window.history.back();
                        </script>
                    `);
                }

                const result = jsonResult;
                console.log(`[Face Recognition] Result: ${result.recognized ? 'SUCCESS' : 'FAILED'}`);

                if (result.success && result.recognized) {
                    try {
                        const attendanceRecord = await MarkPresent.create({
                            rollNumber: parseInt(rollNumber),
                            studentName: student.name,
                            timestamp: new Date(),
                            method: 'face_recognition',
                            confidence: result.confidence,
                            status: 'present',
                            framesProcessed: result.frames_processed || 0
                        });

                        console.log(`[Face Recognition] ✓ Saved to database`);
                        
                        return res.status(200).send(`
                            <script>
                                alert('✓ Attendance Marked!\\n\\nStudent: ${student.name}\\nConfidence: ${(result.confidence * 100).toFixed(1)}%');
                                window.location.href = '/student/portal';
                            </script>
                        `);
                        
                    } catch (dbError) {
                        console.error('[Face Recognition] ✗ Database error:', dbError.message);
                        return res.status(500).send(`
                            <script>
                                alert('Failed to save attendance');
                                window.history.back();
                            </script>
                        `);
                    }
                    
                } else {
                    console.log(`[Face Recognition] ✗ Not recognized`);
                    
                    return res.status(200).send(`
                        <script>
                            alert('✗ Face Not Recognized\\n\\nTry again with better lighting');
                            window.history.back();
                        </script>
                    `);
                }
            } catch (parseError) {
                console.error('[Face Recognition] ✗ Parse error:', parseError.message);
                return res.status(500).send(`
                    <script>
                        alert('Failed to process result');
                        window.history.back();
                    </script>
                `);
            }
        });

    } catch (error) {
        console.error('[Face Recognition] ✗ Controller Error:', error.message);
        return res.status(500).send(`
            <script>
                alert('Server error');
                window.history.back();
            </script>
        `);
    }
};