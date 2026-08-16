const multer = require('multer');
const path = require('path');
const {v4 : uuidv4} = require('uuid');

//Define storage
const storage = multer.diskStorage({
    destination : function(req , file , cb){
        cb(null , 'uploads/')
    } , 
    filename : function (req , file, cb){
        const uniqueName = uuidv4() + path.extname(file.originalname);
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