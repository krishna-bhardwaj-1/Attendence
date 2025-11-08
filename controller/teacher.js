const Teacher = require('../models/teacher');
const ClassAccess = require('../models/classAccess');
const MarkPresent = require('../models/markpresent');

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
    const { teacherId, password } = req.body;
    const teacher = await Teacher.findOne({ teacherId, password });
    if (!teacher) {
        return res.redirect('/');
    }
    res.render('../views/teacher/portal', { teacher, timetable: sampleTimetable });
}

// Grant or revoke access to students
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

        // Find existing access record or create new one
        let classAccess = await ClassAccess.findOne({ subject, time, room });

        if (classAccess) {
            // Update existing record
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
            // Create new record
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

// Check access status
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

// Get attendance for specific class
module.exports.getAttendance = async (req, res) => {
    try {
        const { subject, time, room } = req.query;
        
        console.log(`[Get Attendance] Fetching for ${subject} at ${time}`);
        
        // Get today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendance = await MarkPresent.find({
            timestamp: { $gte: today }
        }).sort({ timestamp: -1 });
        
        console.log(`[Get Attendance] Found ${attendance.length} records`);
        
        res.json({
            success: true,
            attendance: attendance
        });
    } catch (error) {
        console.error('Error getting attendance:', error);
        res.json({ success: false, message: error.message });
    }
};