// server/middleware/upload.js
const multer = require('multer');
const path = require('path');

// Set up storage options
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join('/app/client/public/uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});


// File filter to ensure only images are uploaded
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Set file size limit (5MB in this case)
});

module.exports = upload;
