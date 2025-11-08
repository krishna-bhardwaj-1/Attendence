const express = require('express');
const router = express.Router();
const teacherController = require('../controller/teacher');

router.get('/register', teacherController.getRegister);
router.post('/register', teacherController.postRegister);
router.post('/portal', teacherController.postPortal);

// Access control
router.post('/grant-access', teacherController.grantAccess);
router.get('/check-access-status', teacherController.checkAccessStatus);

// Attendance
router.get('/get-attendance', teacherController.getAttendance);

module.exports = router;