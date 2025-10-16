const mongoose = require('mongoose');

const classAccessSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: true
    },
    accessGranted: {
        type: Boolean,
        default: false
    },
    teacherId: {
        type: String,
        required: true
    },
    grantedAt: {
        type: Date,
        default: null
    },
    revokedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Create a compound index to ensure one record per class session
classAccessSchema.index({ subject: 1, time: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('ClassAccess', classAccessSchema);