const express = require('express');
const router = express.Router();
const teacherController = require('../controller/teacher');

// Login route - GET (show login form)
router.get('/login', (req, res) => {
    res.render('../views/teacher/login');
});

// Portal route - GET (show portal for logged-in teachers)
router.get('/portal', teacherController.getPortal);

// Portal route - POST (verify credentials and send OTP)
router.post('/portal', teacherController.postPortal);

// OTP verification route - POST (verify OTP and login)
router.post('/verify-otp', teacherController.verifyOTP);

// Register routes
router.get('/register', teacherController.getRegister);
router.post('/register', teacherController.postRegister);

// Access control
router.post('/grant-access', teacherController.grantAccess);
router.get('/check-access-status', teacherController.checkAccessStatus);

// Attendance routes
router.get('/get-attendance-records', teacherController.getAttendanceRecords); // For displaying attendance list
router.get('/mark-face-recognition', teacherController.getAttendance); // For face recognition (if needed)

module.exports = router;