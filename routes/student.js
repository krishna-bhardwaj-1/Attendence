const express=require('express');
const router=express.Router();
const upload=require('../middleware/cloudinary');

const studentController=require('../controller/student');

router.get('/signup',studentController.getSignUp);

router.post('/portal',studentController.postPortal);

router.post('/signup',upload.single('photo'),studentController.postSignUp);

router.get('/check-access', studentController.checkAccess);

router.get('/mark-attendence-face', studentController.getMarkAttendenceFace);

module.exports=router;