const express = require('express');
const router = express.Router();
const teacherController = require('../controller/teacher');

// Login route - GET (show login form)
router.get('/login', (req, res) => {
    res.render('../views/teacher/login');
});

router.get('/portal', teacherController.getPortal);

router.post('/portal', teacherController.postPortal);

router.post('/verify-otp', teacherController.verifyOTP);

// Register routes
router.get('/register', teacherController.getRegister);
router.post('/register', teacherController.postRegister);

// Access control
router.post('/grant-access', teacherController.grantAccess);
router.get('/check-access-status', teacherController.checkAccessStatus);

// Attendance routes
router.get('/get-attendance-records', teacherController.getAttendanceRecords);
router.get('/mark-face-recognition', teacherController.getAttendance);

module.exports = router;