const express = require("express");
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const googleClient = require('../config/google');
const commonRepo = require('../functions/common')
const authenticationRepo= require('../functions/authentication');
const usersRepo = require('../functions/users');
const { sendVerificationEmail } = require("../functions/emails");


router.get('/checkname/:name' , async (req , res) =>{ //checks if username is available on register or username update 
    try{
        const {name} = req.params;
        const nameValidation = commonRepo.validateName(name);
        if(!nameValidation.valid) return res.status(400).json("Name Is Invalid");
        const nameExist = await usersRepo.getUserByName(name);
        if(nameExist === undefined) return res.status(200).json("Username Is Available");
        return res.status(400).json("Username Is Unavailable");
    }catch(err){
         console.error("Error checking username" , err);
            return res.status(500).json("Internal Server Error");
    }
})


router.get('/auth' , authenticationRepo.authenticateUser , (req , res)=>{
    try{
        return res.status(200).json(req.user);
    }catch(err){
         console.error("Error authentication user" , err);
            return res.status(500).json("Internal Server Error");
    }
});


router.post('/register'  , async(req , res) =>{//register user expects an object that has name , email , password , confirm_password
    try{
        const user = req.body;
        const userValidation = usersRepo.validateRegister(user);
        if(!userValidation.valid) return res.status(400).json("Register Information Is Invalid");
        const checkUserExist = await usersRepo.getUserByEmail(user.email);
        if(checkUserExist !== undefined) return res.status(409).json('Email Is Already Registered')
        const newId = await usersRepo.registerUser(user);        
        const verificationToken = await usersRepo.addVerificationToken(newId);
        await sendVerificationEmail(user.email , verificationToken);
        return res.status(201).json('Registered Successfully');

    }catch(err){//if duplicate
         if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json("Email Already Exists");
   }
        console.error("Error registering user" , err);
        return res.status(500).json("Internal Server Error");
    }
});

router.get('/verify-email'  , authenticationRepo.authenticateUser , async(req , res) =>{ //verify if token provided matches the on eon the system
    try{
        const {token} = req.query;
        const verified = await usersRepo.verifyToken(token);
        if(verified === undefined) return res.status(401).json('Email Verification Failed');
        return res.status(200).json('Email Verified');

    }catch(err){
        console.error("Error validating email token" , err);
        return res.status(500).json("Internal Server Error");
    }
})


router.post('/resend-token', authenticationRepo.authenticateUser , async(req , res) =>{ //resend the email verification token if expired
    try{
        const {user_id , email} = req.user;
        const verificationToken = await usersRepo.addVerificationToken(user_id);
        await sendVerificationEmail(email , verificationToken);
        return res.status(201).json("Verification Token Sent To Email");
    }catch(err){
         console.error("Error sending email token" , err);
        return res.status(500).json("Internal Server Error");
    }
})

router.post('/login' , async (req , res)=>{ //login user
    try{
        const {email , password} = req.body;
        const loginValidation = usersRepo.validateLogin(req.body);
        if(!loginValidation.valid) return res.status(401).json("Invalid Email Or Password");
        const user = await usersRepo.getUserByEmailWithHash(email);
        if(user === undefined) return res.status(401).json("Invalid Email Or Password");
        const passwordMatch = await bcrypt.compare(password , user.password_hash); //use bcrypt to compare hashed password in db with the provided password
        if(!passwordMatch) return res.status(401).json("Invalid Email Or Password");
        const payload = { //create payload for jwt token
            user_id : user.user_id , 
            name : user.name,
            email : user.email , 
            role : user.role , 
            email_verified : user.email_verified
        };
        const token = jwt.sign(payload , process.env.JWT_SECRET , { expiresIn : process.env.JWT_EXPIRES_IN } ); //create token 
        res.cookie('token' , token , authenticationRepo.addCookieOptions);
        res.clearCookie('cart_id' , authenticationRepo.clearCookieOptions);
        return res.status(200).json(payload)

    }catch(err){
         console.error("Error logging user" , err);
         return res.status(500).json("Internal Server Error");
    }

});

router.post('/google' , async (req , res) =>{
    try{
        const {credential} = req.body;
        let user_id = '';
        if(!credential) return res.status(400).json('Missing credentials');
        const ticket = await googleClient.verifyIdToken({
            idToken : credential , 
            audience : process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const {sub : googleId , email , email_verified , name} = payload;
        if(!email_verified) return res.status(400).json('Google email not verified');
        const checkUserExist = await usersRepo.getUserByEmail(email);
        if(checkUserExist === undefined){ //if not registered register new user
            const newId = await usersRepo.registerGoogle({name , email , googleId});
            user_id = newId;
        }else{ // if user already exists
            if(checkUserExist.email_verified !== 'google'){ //if not registered with google
                await usersRepo.switchAuthProivder({user_id : checkUserExist.user_id , googleId});
                user_id = checkUserExist.user_id;
            }else user_id = checkUserExist.user_id; //if registered with google
        }

            const user = await usersRepo.getUserById(user_id);
            const token = jwt.sign(user , process.env.JWT_SECRET , {expiresIn : process.env.JWT_EXPIRES_IN});
            res.cookie('token' , token , authenticationRepo.addCookieOptions);
            return res.status(200).json(user);
    }catch(err){
         console.error("Error logging user with google" , err);
         return res.status(500).json("Internal Server Error");
    }
})


router.patch('/password', authenticationRepo.authenticateUser  , async(req,res)=>{ //updates users password , requires old password , new password , and confirm new password
    try{
        console.log(req.body)
        const {password , new_password , confirm_password} = req.body;
        const passwordsValidation = usersRepo.validateUpdatePassword({password , new_password , confirm_password}); //validate params meet the criteria
        if(!passwordsValidation.valid) return res.status(400).json("Information Provided Is Invalid Please Try Again")
        const { user_id , email } = req.user;
        const user = await usersRepo.getUserByEmailWithHash(email);  //get the old password to compare it with the old password the user entered
        if(user === undefined) return res.status(404).json("User Doesn't Exist")
        const hashPassword = user.password_hash;
        const passwordMatch = await bcrypt.compare(password ,hashPassword);//compare
        if(!passwordMatch) return res.status(400).json("Your Password Is Incorrect");
        const result = await usersRepo.updatePassword(user_id , new_password);
        if(result === undefined) res.status(500).json('Something Went Wrong Please Contact Your Administrator');
        return res.status(200).json(req.user);
    }catch(err){
            console.error("Error changing password user" , err);
            return res.status(500).json("Internal Server Error");
    }
});

router.patch('/username' , authenticationRepo.authenticateUser  , async (req , res)=>{ //change username expects name
    try{   
        const {name} = req.body;
        const nameValidation = commonRepo.validateName(name);
        if(!nameValidation.valid) return res.status(400).json("New Username Is Invalid")
        const result = await usersRepo.updateUsername(req.user.user_id , name);
        if(result === undefined) return res.status(500).json('Something Went Wrong Please Contact Your Administrator');
        const user = await usersRepo.getUserById(req.user.user_id);
        return res.status(200).json(user);

    }catch(err){
        console.error("Error changing username" , err);
            return res.status(500).json("Internal Server Error");
    }
});




router.post('/logout' , authenticationRepo.authenticateUser, (req , res) =>{
    try{
        res.clearCookie('token' , authenticationRepo.clearCookieOptions );
        return res.status(200).json("Logged Out");
    }catch(err){
            console.error("Error logging out" , err);
            return res.status(500).json("Internal Server Error");
    }
})





module.exports = router;
