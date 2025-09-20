const path=require('path');
const express=require('express');
const router=express.Router();
const upload=require('../middleware/cloudinary');

const studentController=require('../controller/student');

router.get('/signup',studentController.getSignUp);

router.post('/signup',studentController.postSignUp);
router.post('/portal',studentController.postPortal);
//photo
router.post('/signup',upload.single('photo'),studentController.postSignUp);

module.exports=router;