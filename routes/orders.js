const express = require('express');
const authenticationRepo = require('../functions/authentication');
const ordersRepo = require('../functions/orders');
const router = express.Router();


router.get('/' , authenticationRepo.authenticateUser , async(req , res)=>{ //return order by user
    try{
        const {user_id} = req.user;
        const orders = await ordersRepo.getOrdersByUserId(user_id);
        return res.status(200).json(orders)
    }catch(err){
        console.error("Error getting orders of user" , err);
        return res.status(500).json("Internal Server Error");
    }
})










module.exports = router;