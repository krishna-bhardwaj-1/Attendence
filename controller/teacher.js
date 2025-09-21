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

module.exports.postPortal=async (req,res,next)=>{
    const {teacherId,password}=req.body;
    const teacher=await Teacher.findOne({teacherId,password});
    if(!teacher){
        return res.redirect('/');
    }
    res.render('../views/teacher/portal',{teacher,timetable:sampleTimetable});
}