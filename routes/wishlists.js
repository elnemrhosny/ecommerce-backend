const express = require('express');
const authenticationRepo = require('../functions/authentication');
const commonRepo = require('../functions/common');
const productsRepo = require('../functions/products');
const wishlistsRepo = require('../functions/wishlists');

const router = express.Router();



router.get('/' , authenticationRepo.authenticateUser , async (req , res) =>{ //getting wishlist of user
    try{
        const {user_id} = req.user;
        const offset = parseInt(req.query.offset, 10) || 0;   // default 0
        const limit = parseInt(req.query.limit, 10) || 12;    
        const wishlist = await wishlistsRepo.getWishlist(user_id , offset , limit);
        const count = await wishlistsRepo.getCount(user_id);
        return res.status(200).json({wishlist , count})
    }catch(err){
            console.error("Error getting wishlist" , err);
           return res.status(500).json("Internal Server Error");
    }
})

router.get('/count' , authenticationRepo.authenticateUser , async (req , res) =>{ //getting wishlist of user
    try{
        const {user_id} = req.user;
        const count = await wishlistsRepo.getCount(user_id);
        return res.status(200).json(count)
    }catch(err){
            console.error("Error getting wishlist" , err);
           return res.status(500).json("Internal Server Error");
    }
})



router.post('/' , authenticationRepo.authenticateUser , async (req , res)=>{ //query to add product to wishlist
    try{
        const {product_id} = req.body;
        const idValidation = commonRepo.validateId(product_id);
        if(!idValidation.valid)return res.status(400).json("Product ID Is Invalid");
        const product = await productsRepo.getProductById(product_id);
        if(product === undefined) return res.status(404).json("Product Doesn't Exist");
        const result = await wishlistsRepo.addProduct(product_id , req.user.user_id);
        if(result === undefined) return res.status(500).json("Please Contact Your Administrator"); 
        const wishlist = await wishlistsRepo.getWishlist(req.user.user_id);
        return res.status(201).json(wishlist)
    }catch(err){
         if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json("Product Already Exists In Wishlist");
          }
            console.error("Error adding product to wishlist" , err);
           return res.status(500).json("Internal Server Error");
    }
})

router.delete('/:product_id' , authenticationRepo.authenticateUser , async (req , res)=>{ //deleting a product from wishlist
    try{   
        const {product_id} = req.params;
        const {user_id} = req.user;
        const idValidation = commonRepo.validateId(product_id);
        if(!idValidation.valid) return res.status(400).json("Product ID Is Invalid");
        const result = await wishlistsRepo.deleteProduct(product_id , user_id);
        if(result === undefined) return res.status(404).json("Product Doesn't Exist In Your Wishlist");
        const wishlist = await wishlistsRepo.getWishlist(user_id);
        return res.status(200).json(wishlist)
    }catch(err){
         console.error("Error deleting product from wishlist" , err);
           return res.status(500).json("Internal Server Error");
    }
})




module.exports = router;