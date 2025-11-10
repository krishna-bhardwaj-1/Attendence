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

module.exports.postPortal = async (req, res, next) => {
    try {
        const { teacherId, password } = req.body;
        
        if (!teacherId || !password) {
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
            return res.json({
                success: false,
                message: 'Invalid credentials. Please check your teacher ID and password.'
            });
        }
        
        let teacherEmail = teacher.email;
        if (teacherEmail && teacherEmail.includes('@@')) {
            teacherEmail = teacherEmail.replace(/@@+/g, '@');
        }
        
        if (req.session) {
            req.session.teacherId = teacher._id;
            req.session.teacherIdNum = teacher.teacherId;
            req.session.teacherName = teacher.name;
            req.session.teacherEmail = teacherEmail;
        }
        
        const otpResult = await sendOTP(teacherEmail, teacher.name);
        
        if (!otpResult.success) {
            return res.json({
                success: false,
                message: otpResult.message || 'Failed to send OTP. Please try again.'
            });
        }
        
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

module.exports.verifyOTP = async (req, res, next) => {
    try {
        const { otp } = req.body;
        
        if (!otp) {
            return res.json({
                success: false,
                message: 'Please enter the OTP'
            });
        }
        
        const teacherEmail = req.session?.teacherEmail;
        
        if (!teacherEmail) {
            return res.json({
                success: false,
                message: 'Session expired. Please login again.'
            });
        }
        
        const verificationResult = verifyOTP(teacherEmail, otp);
        
        if (!verificationResult.success) {
            return res.json({
                success: false,
                message: verificationResult.message
            });
        }
        
        if (req.session) {
            req.session.teacherLoggedIn = true;
        }
        
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

module.exports.getPortal = async (req, res, next) => {
    try {
        if (!req.session || !req.session.teacherLoggedIn || !req.session.teacherId) {
            return res.redirect('/');
        }
        
        const teacher = await Teacher.findById(req.session.teacherId);
        
        if (!teacher) {
            req.session.destroy();
            return res.redirect('/');
        }
        
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendance = await MarkPresent.find({
            subject: subject,
            time: time,
            room: room,
            timestamp: { $gte: today }
        }).sort({ timestamp: -1 }).lean();

        const totalStudents = await Student.countDocuments();

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

module.exports.getAttendance = async (req, res, next) => {
    try {
        let rollNumber = null;
        
        if (req.query && req.query.rollNumber) {
            rollNumber = req.query.rollNumber;
        } else if (req.body && req.body.rollNumber) {
            rollNumber = req.body.rollNumber;
        } else if (req.session && req.session.student && req.session.student.rollNumber) {
            rollNumber = req.session.student.rollNumber;
        }
        
        if (!rollNumber) {
            return res.status(200).json({ 
                success: false, 
                message: 'Roll number required' 
            });
        }

        const student = await Student.findOne({ rollNumber: parseInt(rollNumber) });
        
        if (!student) {
            return res.status(404).send(`
                <script>
                    alert('Student not found');
                    window.history.back();
                </script>
            `);
        }

        if (!student.photo) {
            return res.status(400).send(`
                <script>
                    alert('No photo registered. Please upload photo first.');
                    window.history.back();
                </script>
            `);
        }
        
        if (!student.photo.includes('cloudinary.com')) {
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
                    return res.status(500).send(`
                        <script>
                            alert('Failed to parse result');
                            window.history.back();
                        </script>
                    `);
                }

                const result = jsonResult;

                if (result.success && result.recognized) {
                    try {
                        await MarkPresent.create({
                            rollNumber: parseInt(rollNumber),
                            studentName: student.name,
                            timestamp: new Date(),
                            method: 'face_recognition',
                            confidence: result.confidence,
                            status: 'present',
                            framesProcessed: result.frames_processed || 0
                        });
                        
                        return res.status(200).send(`
                            <script>
                                alert('✓ Attendance Marked!\\n\\nStudent: ${student.name}\\nConfidence: ${(result.confidence * 100).toFixed(1)}%');
                                window.location.href = '/student/portal';
                            </script>
                        `);
                        
                    } catch (dbError) {
                        console.error('Database error:', dbError.message);
                        return res.status(500).send(`
                            <script>
                                alert('Failed to save attendance');
                                window.history.back();
                            </script>
                        `);
                    }
                    
                } else {
                    return res.status(200).send(`
                        <script>
                            alert('✗ Face Not Recognized\\n\\nTry again with better lighting');
                            window.history.back();
                        </script>
                    `);
                }
            } catch (parseError) {
                console.error('Parse error:', parseError.message);
                return res.status(500).send(`
                    <script>
                        alert('Failed to process result');
                        window.history.back();
                    </script>
                `);
            }
        });

    } catch (error) {
        console.error('Controller error:', error.message);
        return res.status(500).send(`
            <script>
                alert('Server error');
                window.history.back();
            </script>
        `);
    }
};