require('dotenv').config();
const express=require('express');
const session = require('express-session');
const app=express();
const path=require('path');
const port = process.env.PORT || 8000;
const mongoose=require('mongoose');
app.set('view engine','hbs');

app.use((req, res, next) => {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'smart-attendance-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 30 * 60 * 1000, // 30 minutes
        httpOnly: true
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

// Connect to MongoDB Atlas with better timeout handling
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 60000,  // Increase timeout to 60 seconds
    socketTimeoutMS: 60000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority',
    wtimeout: 10000
}).then(()=>{
    app.listen(port,()=>{
        console.log('✅ MongoDB Atlas connected successfully');
        console.log(`🚀 Server Connected Successfully at ${port}`);
    })
})
.catch((err)=>{
    console.error('❌ Database connection error:', err.message);
    setTimeout(() => {
        process.exit(1);
    }, 10000);
})