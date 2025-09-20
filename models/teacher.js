const mongoose=require('mongoose');
const {Schema}=mongoose;

const teacherSchema=new Schema({
    teacherId:{
        type:String,
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
    password:{
        type:String,
        required:true
    },
    department:{
        type:String,
        required:true
    },
    designation:{
        type:String,
        required:true
    }
})

module.exports=mongoose.model('teacher',teacherSchema);