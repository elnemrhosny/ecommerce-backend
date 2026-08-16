const express = require('express');
const pool = require('../db')
const { v4 : uuidv4 } = require('uuid');
const commonRepo = require('../functions/common');
const cartsRepo = require('../functions/carts')
const authenticationRepo = require('../functions/authentication')
const productsRepo = require('../functions/products')

const router = express.Router();


router.get('/' , authenticationRepo.cartIdentifier, async ( req , res)=>{ //this endpoint return data as cart_id , items , total_price , 
    try{
        const cart = await cartsRepo.getCartById(req.cart_id);
        return res.status(200).json(cart);

    }catch(err){
            console.error("Error getting cart for user" , err);
           return res.status(500).json("Internal Server Error");
    }
});



router.post('/' , authenticationRepo.cartIdentifier  , async ( req , res)=>{// adding and item to a user cart after authentication with middleware
    try{
        const cart_id = req.cart_id;
        const {product_id}  = req.body;
        const idValidation = commonRepo.validateId(product_id); 
        if(!idValidation.valid) return res.status(400).json("Product ID Is Invalid");
        const product = await productsRepo.getProductById(product_id); 
        if(product === undefined) { //if product is not found
            return res.status(400).json("Prduct Doesn't Exist");
        }

         if(product.stock === 0) { //if item is out of stock , return false and notify user
            return res.status(400).json("Product Is Out Of Stock");
        }
        const productExistsInCart = await cartsRepo.checkProductExistInCart(cart_id , product_id);
        if(productExistsInCart !== undefined) return res.status(409).json("Product Is Already In The Cart");
        const item_id = await cartsRepo.addItem(cart_id , product_id);         
        const cart = await cartsRepo.getCartById(cart_id); //getting  the cart
         return res.status(201).json(cart);

    }catch(err){
            console.error("Error adding item to cart for the user" , err);
            return res.status(500).json("Internal Server Error");
    }
});



router.delete('/:item_id' , authenticationRepo.cartIdentifier  , async ( req , res )=>{
    try{
        const {item_id} = req.params;
        const cart_id = req.cart_id;
        const idValidation = commonRepo.validateId(item_id);
        if(!idValidation.valid) return res.status(400).json("Item ID Is Invalid");
        const itemExist= await cartsRepo.getItemById(item_id , cart_id);
        if(itemExist === undefined) return res.status(404).json("Item Doesn't Exist In Cart");
        const result = await cartsRepo.deleteItem(item_id , cart_id);
        if(result === undefined) return res.status(500).json("Please Contact Your Administrator");
        const cart = await cartsRepo.getCartById(cart_id);
        return res.status(200).json(cart)
    }catch(err){
            console.log("Error deleting item from cart" , err);
            return res.status(500).json("Internal Server Error");
    }
});

router.patch('/' , authenticationRepo.cartIdentifier  , async (req , res )=>{
    try{
        const {item_id , quantity} = req.body;
        const cart_id = req.cart_id;
        const idValidation = commonRepo.validateId(item_id);
        const quantityValidation = cartsRepo.validateQuantity(quantity);
        if(!idValidation.valid) return res.status(400).json("Item ID Is Invalid");
        if(!quantityValidation.valid) return res.status(400).json("Quantity Has To Be A Valid Number");
        const itemExist = await cartsRepo.getItemById(item_id , cart_id );
        if(itemExist === undefined) return res.status(404).json("Item Doesn't Exist In Cart");
        const quantityCheck = await productsRepo.getProductById(itemExist.product_id);
        if(quantity > quantityCheck.stock) return res.status(400).json("Quantity Exceeded Stock");
        const result = await cartsRepo.updateQuantity(item_id , cart_id , quantity);
        if(result === undefined) return res.status(500).json("Please Contact Your Administrator");
        const cart = await cartsRepo.getCartById(cart_id);
        return res.status(200).json(cart)
    }catch(err){
            console.log("Error modifying quantity of item from cart" , err);
            return res.status(500).json("Internal Server Error");
    }
})






module.exports = router;