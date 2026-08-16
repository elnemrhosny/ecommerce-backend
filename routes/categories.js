const express = require("express");
const pool  = require("../db");
const authenticationRepo= require('../functions/authentication');
const commonRepo = require('../functions/common')
const categoryRepo= require("../functions/categories");
const router = express.Router();

router.get("/" , async (req , res)=>{ //to get all categories info
    try{
        const categories = await categoryRepo.getAllCategories();
        return res.status(200).json(categories)
    }catch(err){
        console.error("Error getting categories" , err);
        return res.status(500).json("Internal Server Error")
    }
});













module.exports = router;