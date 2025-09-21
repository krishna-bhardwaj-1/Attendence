const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: 'dclfeyrqx',
    api_key: '545276635636739', 
    api_secret: 'wYUjESOthXZIuTBAbjBXtUqcq1U'
});

// Test connection
// cloudinary.api.ping()
//     .then(result => console.log('Cloudinary connected:', result))
//     .catch(error => console.error('Cloudinary connection failed:', error));

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'students',
        public_id: (req, file) => {
            return 'student_' + Date.now();
        }
    }
});

const upload = multer({ 
    storage: storage,
    onError: function(err, next) {
        console.error('Multer error:', err);
        next(err);
    }
});


module.exports = upload;