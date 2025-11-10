const mongoose = require('mongoose');
const { Schema } = mongoose;

const markPresentSchema = new Schema({
    rollNumber: {
        type: Number,
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    method: {
        type: String,
        enum: ['face_recognition', 'manual', 'qr_code'],
        default: 'face_recognition'
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'late'],
        default: 'present'
    },
    framesProcessed: {
        type: Number,
        default: 0
    },
    subject: {
        type: String
    },
    time: {
        type: String
    },
    room: {
        type: String
    }
});

module.exports = mongoose.model('MarkPresent', markPresentSchema);