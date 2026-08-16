const jwt = require('jsonwebtoken');
const pool = require('../db');
const commonRepo = require('../functions/common');
const cartsRepo = require('../functions/carts');
const usersRepo = require('./users');


const authenticateUser = async function(req , res , next){ //middleware to authenticate user 
    const token = req.cookies.token;
    if(!token){
        return res.status(401).json("Access Denied No Token Provided");
    }

    try{
        const decodedToken = jwt.verify(token , process.env.JWT_SECRET);
        req.user = await usersRepo.getUserById(decodedToken.user_id); //store user info in req.user
        res.clearCookie('cart_id' , clearCookieOptions);
        return next();
    }catch(err){
        console.error("Error authenticating user" , err);
        return res.status(401).json("Authentication Failed");
}
}

const optionalAuth = async function(req , res , next){ //middleware to authenticate user 
    const token = req.cookies.token;
    if(token){
         try{
        const decodedToken = jwt.verify(token , process.env.JWT_SECRET);
        req.user = await usersRepo.getUserById(decodedToken.user_id); //store user info in req.user
        console.log('in authuser' , req.user)
        res.clearCookie('cart_id' , clearCookieOptions);
        return next();
    }catch(err){
        req.user = null;
}
    }
    req.user = null;
    next();

   
}


const authenticateAdmin = async function(req , res , next){ //middleware to authenticate admin 
    const token = req.cookies.token;
    if(!token){
        return res.status(401).json("Access Denied No Token Provided");
    }
    try{
        const decodedToken = jwt.verify(token , process.env.JWT_SECRET);
        req.user = await usersRepo.getUserById(decodedToken.user_id);
        if(decodedToken.role !== 'admin') return res.status(403).json("You Dont Have Permission To Access This Resource")
         //store user info in req.user
         res.clearCookie('cart_id' , clearCookieOptions);
        return next();
    }catch(err){
        console.error("Error authenticating user" , err);
        return res.status(401).json("Authentication Failed");
}
}

const cartIdentifier = async function(req , res , next){ //identifier for getting cart id , if its a user req.user_id will not be null , creates a new cart if not found always returns req.cart_id if user or guest
    const token = req.cookies.token;
    if(token){ //if auth token exists
        try{ //verify with jwt verify if authenticated then get cart of user and if doesnt have cart create one and set it to req.cart_id
             const decodedToken = jwt.verify(token , process.env.JWT_SECRET);
             req.user = await usersRepo.getUserById(decodedToken.user_id); //store user info in req.user
             const cart = await cartsRepo.getCartIdByUserId(req.user.user_id);
             if(cart === undefined){ //if no cart found create one
                req.cart_id = await cartsRepo.createUserCart(req.user.user_id);
             }    
            else req.cart_id = cart.cart_id;
            res.clearCookie('cart_id' , clearCookieOptions);
            return next();
        }catch(err){ //if error is not from jwt token then return response query failed from server sire
            if (err.name != 'JsonWebTokenError' && err.name != 'TokenExpiredError'){
             console.error("Error validating cart" , err);
            return res.status(500).json({
            valid : false,
            data : null ,
            messages : ["Validating cart of user failed server error"]
        });
    }
       
        };
    }
        try{     //guest logic
            let cart_id = req.cookies.cart_id;
            const idValidation = commonRepo.validateId(cart_id);
            if(idValidation.valid){ //if cart_id exists validate the id and get it from database , if it exists in the db set req.cart_id and next()
                const result = await cartsRepo.checkGuestCartById(cart_id);
                if(result !== undefined){ 
                req.cart_id = cart_id;
                return next();
            }
            }
            //if id is not valid or doesnt exist in the db create a new cart and set the cookie and req.cart_id
            req.cart_id = await cartsRepo.createGuestCart();
            res.cookie('cart_id' , req.cart_id , addCookieOptions);
            return next();
        }catch(err){
             console.error("Error validating cart" , err);
            return res.status(500).json({
            valid : false,
            data : null ,
            messages : ["Validating cart of guest failed"]
            })
        }
    }

    

    
     
        

      
      
    


const addCookieOptions = {
    httpOnly : true , 
    secure : process.env.NODE_ENV === 'production' , 
    sameSite : 'lax' ,
    maxAge : 7 * 24 * 60 * 60 * 1000 , 
    path : '/'
}
const clearCookieOptions = {
    httpOnly : true , 
    secure : process.env.NODE_ENV === 'production' , 
    sameSite : 'lax' ,
    path : '/'
}


module.exports = {authenticateUser , authenticateAdmin , cartIdentifier ,optionalAuth , addCookieOptions , clearCookieOptions}