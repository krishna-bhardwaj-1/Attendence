const Student=require('../models/student');

module.exports.getSignUp=async (req,res,next)=>{
    res.render('../views/student/signup')
}

module.exports.postSignUp=async (req,res,next)=>{
    try{
        const {rollNumber,name,email,phone,course,branch,year,semester}=req.body;
        await Student.create({
            photo:req.file.path,
            rollNumber,
            name,
            email,
            phone,
            course,
            branch,
            year,
            semester
        });
    }
    catch(err){
        console.log(err);
    }
    res.redirect('/');
}

module.exports.postPortal=async (req,res,next)=>{
    const {rollNumber,name}=req.body;
    const student=await Student.findOne({rollNumber,name});
    if(!student){
        return res.redirect('/');
    }
    res.render('../views/student/portal',{student});
}
