const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dclfeyrqx',
    api_key: process.env.CLOUDINARY_API_KEY || '599956197579755', 
    api_secret: process.env.CLOUDINARY_API_SECRET || 'WEzJe0B3gfT0yF-r5-0zKMPGEDM'
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