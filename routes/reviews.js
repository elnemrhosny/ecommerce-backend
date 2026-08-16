const express = require('express');
const authenticationRepo = require('../functions/authentication');
const reviewsRepo = require('../functions/reviews');
const commonRepo = require('../functions/common');
const productsRepo = require('../functions/products');
const { date } = require('joi');

const router = express.Router();

router.get('/product' , async (req,res)=>{ //get reviews by product
        try{
            const {product_id} = req.query;
            const idValidation = commonRepo.validateId(product_id);
            if(!idValidation.valid) return res.status(400).json("Product ID Is Invalid");
            const productExist = await productsRepo.getProductById(product_id);
            if(productExist === undefined) return res.status(400).json("Product Doesn't Exist");
            const reviews = await reviewsRepo.getReviewsByProduct(product_id);
            return res.status(200).json(reviews)
        }catch(err){
            console.error("Error getting reviews for product" , err);
            return res.status(500).json("Internal Server Error");
        }
})

router.get('/user' , authenticationRepo.authenticateUser ,async (req,res)=>{ //get reviews by users
        try{
            const {user_id} = req.user;
            const reviews = await reviewsRepo.getReviewsByUser(user_id);
            return res.status(200).json(reviews)
        }catch(err){
            console.error("Error getting reviews for user" , err);
            return res.status(500).json("Internal Server Error");
        }
})


router.post('/' , authenticationRepo.authenticateUser , async(req , res)=>{ //add a review
    try{
        const {rating , comment , product_id} = req.body;
        const {user_id} = req.user;
        const productIdValidation = commonRepo.validateId(product_id);
        if(!productIdValidation.valid) return res.status(400).json("Product ID Is Invalid");
        const productExist = await productsRepo.getProductById(product_id , user_id);
        if(productExist === undefined)  return res.status(404).json("Product Doesn't Exist");
        const reviewValidation = reviewsRepo.validateReviewAdd({rating , comment  , user_id , product_id});
        if(!reviewValidation.valid) return res.status(400).json("Review Information Is Invalid");
        const cleanedReview = reviewValidation.data;
        const review_id = await reviewsRepo.addReview(cleanedReview , user_id , product_id);
        if(review_id === undefined) return res.status(500).json("Please Contact Your Administrator");
        const review = await reviewsRepo.getReviewById(review_id);
        return res.status(201).json(review);

    }catch(err){
        if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json("You Already Reviewed This Product");
  }
        console.error("Error adding review" , err);
        return res.status(500).json("Internal Server Error");
    }
})

router.patch('/' , authenticationRepo.authenticateUser , async(req,res)=>{ //update a review
        try{
            const {review_id , rating , comment} = req.body;
            const user_id = req.user.user_id;
            const reviewValidation = reviewsRepo.validateReviewUpdate({review_id , rating , comment  , user_id});
            if(!reviewValidation.valid) return res.status(400).json("Review Information Is Invalid");
            const reviewExist = await reviewsRepo.getReviewById(review_id , user_id);
            if(reviewExist === undefined) return res.status(404).json("Review Doesn't Exist");
            const conditions = [];
            const params = [];
            if(rating !== undefined){
                conditions.push('rating = ?');
                params.push(rating);
            }
            if(comment !== undefined){
                conditions.push('comment = ?');
                params.push(comment);
            }
           const result = await reviewsRepo.updateReview(conditions , params , review_id , user_id);
           if(result === undefined)  return res.status(200).json("Your Data Matches The Existing Review");
           const review = await reviewsRepo.getReviewById(review_id , user_id);
           return res.status(200).json(review)
        }catch(err){
             console.error("Error updating review" , err);
            return res.status(500).json("Internal Server Error");
        }
})


router.delete('/:review_id' , authenticationRepo.authenticateUser , async (req , res)=>{ //delete a review
    try{
        const {review_id} = req.params;
        const {user_id} = req.user;
        const idValidation = commonRepo.validateId(review_id);
        if(!idValidation.valid) return res.status(400).json("Review ID Is Invalid");
        const review = await reviewsRepo.getReviewById(review_id , user_id);
        if(review === undefined) return res.status(404).json("Review Doesn't Exist");
        const result = await reviewsRepo.deleteReview(review_id , user_id);
        if(result === undefined) return res.status(500).json("Please Contact Your Adminstrator");
        const reviews = await reviewsRepo.getReviewsByProduct(review.product_id);
        return res.status(200).json(reviews);

    }catch(err){
         console.error("Error deleting review" , err);
         return res.status(500).json("Internal Server Error");
    }
});



module.exports = router;