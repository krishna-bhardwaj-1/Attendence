const express = require('express');
const router = express.Router();
const upload = require('../middleware/cloudinary');
const studentController = require('../controller/student');

router.get('/login', (req, res) => res.render('../views/student/login'));
router.get('/portal', studentController.getPortal);
router.post('/portal', studentController.postPortal);
router.get('/signup', studentController.getSignUp);
router.post('/signup', upload.single('photo'), studentController.postSignUp);
router.get('/check-access', studentController.checkAccess);
router.post('/recognize-frame', studentController.recognizeFrame);
router.post('/save-attendance', studentController.saveAttendance);
router.get('/recent-attendance', studentController.getRecentAttendance);

module.exports = router;