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

const sampleTimetable = {
    class1: {
        id: 'class1',
        timing: '10:00AM - 11:00 AM',
        subjectName: 'Machine Learning',
        roomNo: 'Academic Block-I 405',
    },
    class2: {
        id: 'class2',
        timing: '11:00AM - 12:00 PM',
        subjectName: 'Database Manag System',
        roomNo: 'Academic Block-I 201',
    },
    class3: {
        id: 'class3',
        timing: '12:00 - 01:00 PM',
        subjectName: 'Operating System',
        roomNo: 'Academic Block-I 406',
    },
    class4: {
        id: 'class4',
        timing: '02:00PM - 03:00 PM',
        subjectName: 'Computer Networks',
        roomNo: 'Academic Block-I 205',
    },
    class5: {
        id: 'class5',
        timing: '03:00 PM - 04:00 PM',
        subjectName: 'Software Engineering',
        roomNo: 'Academic Block-III 102',
    },
    class6: {
        id: 'class6',
        timing: '04:00 PM - 05:00 PM',
        subjectName: 'Mini Project',
        roomNo: 'Academic Block-XI CSED',
    }
};

module.exports.postPortal=async (req,res,next)=>{
    const {rollNumber,name}=req.body;
    const student=await Student.findOne({rollNumber,name});
    if(!student){
        return res.redirect('/');
    }
    res.render('../views/student/portal',{student,timetable:sampleTimetable});
}
