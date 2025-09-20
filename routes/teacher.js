const path=require('path');
const express=require('express');
const router=express.Router();

const teacherController=require('../controller/teacher');

router.get('/register',teacherController.getRegister);

router.post('/register',teacherController.postRegister);
router.post('/portal',teacherController.postPortal);

module.exports=router;