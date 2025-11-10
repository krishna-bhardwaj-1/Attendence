require('dotenv').config();
const express=require('express');
const session = require('express-session');
const app=express();
const path=require('path');
const port=8000;
const mongoose=require('mongoose');
app.set('view engine','hbs');

// Session configuration
app.use(session({
    secret: 'smart-attendance-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 30 * 60 * 1000 // 30 minutes
    }
}));

const bodyParserLimit = '10mb';
app.use(express.json({ limit: bodyParserLimit }));
app.use(express.urlencoded({extended:true, limit: bodyParserLimit}))
app.use(express.static(path.join(__dirname,'public')));

app.get('/',(req,res,next)=>{
    res.render('index');
})

const studentRouter=require('./routes/student');
app.use('/student',studentRouter);

const teacherRouter=require('./routes/teacher');
app.use('/teacher',teacherRouter);

app.use('/api/teacher', teacherRouter);

mongoose.connect('mongodb://127.0.0.1:27017/SmartAttendence').then(()=>{
    app.listen(port,()=>{
        console.log('db connected successfully');
        console.log(`Server Connected Successfully at ${port}`);
    })
})
.catch((err)=>{
    console.log(err);
})