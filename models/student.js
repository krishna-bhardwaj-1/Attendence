const mongoose=require('mongoose');
const {Schema}=mongoose;

const studentSchema=new Schema({
    photo:{
        type:String,
        required:true
    },
    rollNumber:{
        type:Number,
        required:true,
        unique:true
    },
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:Number,
        required:true,
        unique:true
    },
    course:{
        type:String,
        required:true
    },
    branch:{
        type:String,
        required:true
    },
    year:{
        type:String,
        required:true
    },
    semester:{
        type:String,
        required:true
    }
})

module.exports=mongoose.model('student',studentSchema);