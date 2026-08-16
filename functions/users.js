const Joi = require("Joi")
const {randomUUID} = require('crypto');
const bcrypt = require('bcrypt')
const pool = require('../db')

const registerSchema = Joi.object({
    user_id : Joi.forbidden().messages({
        'any.required' : "Cant explicitly add an ID"
    }) , 
    name : Joi.string().trim().min(2).max(50).required().messages({
        'string.empty': 'Name is required',
        'any.required': 'Name is required',
        'string.base': 'Name must be a string'
    }) , 
    email : Joi.string().email().required().messages({
        'string.email' : 'Please enter a valid email address' , 
        'string.empty' : 'Email cannot be empty' , 
        'string.base' : 'Email must be a string' , 
        'any.required' : 'Email is required'
    }) , 
    password : Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
        'string.base': 'Password must be a string',
        'string.empty': 'Password cannot be empty',
        'string.min': 'Password must be at least {8} characters long',
        'string.max': 'Password cannot exceed {128} characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
    }) , 
    confirm_password: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.required': 'Please confirm your password',
    'any.only': 'Passwords do not match',
    'object.unknown': 'Passwords do not match',

  })
}).required().messages({
    'any.required': 'Value cant be null or undefined',
});


const loginSchema = Joi.object({
    email : Joi.string().email().required().messages({
        'string.email' : 'Please enter a valid email address' , 
        'string.empty' : 'Email cannot be empty' , 
        'string.base' : 'Email must be a string' , 
        'any.required' : 'Email is required'
    }) , 
    password : Joi.string().min(8).max(128).required().messages({
        'string.base': 'Password must be a string',
        'string.empty': 'Password cannot be empty',
        'string.min': 'Password must be at least {8} characters long',
        'string.max': 'Password cannot exceed {128} characters',
        'any.required': 'Password is required'
    })
    
}).required().messages({
    'any.required': 'Value cant be null or undefined',
});

const updatePasswordSchema = Joi.object({
    password : Joi.string().min(8).max(128).required().messages({
        'string.base': 'Password must be a string',
        'string.empty': 'Password cannot be empty',
        'string.min': 'Password must be at least {8} characters long',
        'string.max': 'Password cannot exceed {128} characters',
        'any.required': 'Password is required'
    }) , 
    
  new_password : Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
        'string.base': 'New password must be a string',
        'string.empty': 'New password cannot be empty',
        'string.min': 'New Password must be at least {8} characters long',
        'string.max': 'New Password cannot exceed {128} characters',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
    }) , 

    confirm_password: Joi.string().required().valid(Joi.ref('new_password')).messages({
    'any.required': 'Please confirm your password',
    'any.only': 'Passwords do not match',
    'object.unknown': 'Passwords do not match',

  })
}).required().messages({
    'any.required': 'Value cant be null or undefined',
});


const validateRegister = function(user){
    return runValidation(registerSchema , user);
}
const validateLogin = function(user){
    return runValidation(loginSchema , user);
}
const validateUpdatePassword = function(passwords){
    return runValidation(updatePasswordSchema , passwords);
}




const runValidation = function(schema , data){
   
    const { error } = schema.validate(data , {abortEarly : false});
    const validation = {
        valid : !error , 
        messages : error ? error.details.map(d => d.message) : []
        }
    return validation;
}

async function registerUser(user){
    const {name , email , password} = user;
    const role = 'customer';
    const newId = randomUUID();
    const passwordHash = await bcrypt.hash(password , 12); //hashing password
    const [result] = await pool.query('INSERT INTO users (id , name , email , password_hash , role) VALUES(UUID_TO_BIN(?) , ? , ? , ? , ?)' , [newId , name , email , passwordHash , role]);
    if(result.affectedRows === 0) return undefined
    return newId;
}

async function getUserById(user_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) as user_id , name , email , role , auth_provider , email_verified FROM users WHERE id = UUID_TO_BIN(?)' , user_id);
    if(result.length === 0) return undefined;
    return result[0];
}

async function getUserByEmailWithHash(email){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) as user_id , name , email , password_hash , role , auth_provider , email_verified FROM users WHERE email = ? ' ,[ email ]); //get the user requesting to login by email
    if(result.length === 0) return undefined;
    return result[0];
}

async function updatePassword(user_id , new_password){
    const new_password_hash = await bcrypt.hash(new_password , 12); //create new hash password
    const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = UUID_TO_BIN(?)' , [ new_password_hash , user_id]);//send it to db
    if(result.changedRows === 0) return undefined;
    return true;
}

async function updateUsername(user_id , name){
    const [result] = await pool.query('UPDATE users SET name = ? WHERE id = UUID_TO_BIN(?)' , [ name , user_id]);//send it to db
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function getUserByName(name){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) as user_id , name , email , role , auth_provider , email_verified FROM users WHERE name = ?' , name);
    if(result.length === 0) return undefined;
    return result[0];
}

async function getUserByEmail(email){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) as user_id , name , email , role , auth_provider , email_verified FROM users WHERE email = ?' , email);
    if(result.length === 0) return undefined;
    return result[0];
}

async function addVerificationToken(user_id){
    await pool.query('DELETE FROM email_verifications WHERE user_id = UUID_TO_BIN(?)' , [user_id]);
    const token = randomUUID();
    const newId = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); //1 hour
    const [result] = await pool.query('INSERT INTO email_verifications (id , user_id , token , expires_at) VALUES (UUID_TO_BIN(?) , UUID_TO_BIN(?) , ? , ?)' , [newId , user_id , token , expiresAt]);
    if(result.affectedRows === 0 ) return undefined;
    return token;
}

async function verifyToken(token){
    const [result] = await pool.query('SELECT BIN_TO_UUID(user_id) as user_id FROM email_verifications WHERE token = ? AND expires_at > NOW()' , [token]);
    if(result.length === 0) return undefined;
    await pool.query('UPDATE users set email_verified = true WHERE id = UUID_TO_BIN(?)' , [result[0].user_id])
    await pool.query('DELETE FROM email_verifications WHERE user_id = UUID_TO_BIN(?)' , [result[0].user_id]);
    return true;
}

async function registerGoogle(user) {
    const {name , email , googleId} = user;
    const newId = randomUUID();
      await pool.query(
        `INSERT INTO users (id, name, email, role, auth_provider, google_id, email_verified)
         VALUES (UUID_TO_BIN(?), ?, ?, 'customer', 'google', ?, true)`,
        [newId, name, email, googleId]
      );
      return newId;
}

async function switchAuthProivder(user) {
    const {user_id , googleId} = user;
    const [result] =  await pool.query(
        `UPDATE users SET auth_provider = ? , google_id = ? , email_verified = 1 WHERE id = UUID_TO_BIN(?)`,
        ['google', googleId, user_id]
      );
      if(result.affectedRows ===0) return undefined;
      return true;
}



module.exports = {
    validateRegister , 
    validateLogin , 
    validateUpdatePassword , 
    registerUser,
    getUserById , 
    getUserByEmailWithHash ,
    updatePassword , 
    updateUsername , 
    getUserByName ,
    getUserByEmail,
    addVerificationToken,
    verifyToken , 
    registerGoogle , 
    switchAuthProivder
}