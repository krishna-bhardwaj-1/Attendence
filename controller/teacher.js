const Teacher=require('../models/teacher');
module.exports.getRegister=async (req,res,next)=>{
    res.render('../views/teacher/register')
}

module.exports.postRegister=async (req,res,next)=>{
    const {teacherId,name,email,phone,password,department,designation}=req.body;
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

module.exports.postPortal=async (req,res,next)=>{
    const {teacherId,password}=req.body;
    const teacher=await Teacher.findOne({teacherId,password});
    if(!teacher){
        return res.redirect('/');
    }
    res.render('../views/teacher/portal',{teacher});
}