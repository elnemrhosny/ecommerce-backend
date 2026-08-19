const express = require('express');
const authenticationRepo = require('../functions/authentication');
const ordersRepo = require('../functions/orders');
const commonRepo = require('../functions/common');
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
});

router.get('/payment_status' , authenticationRepo.authenticateUser , async(req , res)=>{ //return order by user
    try{
        const {order_id} = req.query;
        const idValidation = commonRepo.validateId(order_id);
        if(!idValidation.valid) return res.status(400).json("Invalid order_id");
        const paymentStatus = await ordersRepo.getPaymentStatus(order_id);
        if(paymentStatus === undefined) return res.status(404).json("Order not found");
        return res.status(200).json(paymentStatus);
    }catch(err){
        console.error("Error getting orders of user" , err);
        return res.status(500).json("Internal Server Error");
    }
});






module.exports = router;