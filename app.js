const express=require('express');
const app=express();
const path=require('path');
const port=8000;
const mongoose=require('mongoose');
app.set('view engine','hbs');

const hbs=require('hbs');
hbs.registerPartials(__dirname+'/views/partials');

app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname,'public')));

app.get('/',(req,res,next)=>{
    res.render('index');
})

const studentRouter=require('./routes/student');
app.use('/student',studentRouter);

const teacherRouter=require('./routes/teacher');
app.use('/teacher',teacherRouter);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


mongoose.connect('mongodb://127.0.0.1:27017/SmartAttendence').then(()=>{
    app.listen(port,()=>{
        console.log('db connected successfully');
        console.log(`Server Connected Successfully at ${port}`);
    })
})
.catch((err)=>{
    console.log(err);
})