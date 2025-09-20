const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: 'dclfeyrqx',
    api_key: '545276635636739', 
    api_secret: 'wYUjESOthXZIuTBAbjBXtUqcq1U'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'students'
    }
});

const upload = multer({ storage: storage });

module.exports = upload;