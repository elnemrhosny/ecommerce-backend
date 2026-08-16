const multer = require('multer');
const path = require('path');
const {randomUUID} = require('crypto');

//Define storage
const storage = multer.diskStorage({
    destination : function(req , file , cb){
        cb(null , 'uploads/')
    } , 
    filename : function (req , file, cb){
        const uniqueName = randomUUID() + path.extname(file.originalname);
        cb(null , uniqueName);
    }
});


//File filter : only allow images
const fileFilter = (req , file , cb) =>{
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLocaleLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if(mimetype && extname) return cb(null , true);
    cb(new Error('Only image files are allowed'))
};


const upload = multer({
    storage : storage , 
    limits : {fileSize : 5 * 1024 * 1024} ,
    fileFilter : fileFilter
});

module.exports = upload;