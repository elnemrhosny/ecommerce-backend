const express = require('express');
const pool = require('../db');
const commonRepo = require('../functions/common')
const productsRepo = require('../functions/products');
const categoryRepo = require('../functions/categories')
const authenticationRepo = require('../functions/authentication');
const upload = require('../middlewares/upload');
const router = express.Router();



router.get('/' , authenticationRepo.optionalAuth,async(req ,res) =>{ //filter products depending on query  returns default 10 products if limit is not provided
    try{
        const { 
      product_id,
      search, //search in product name or description
      category_id, //search bt category uuid
      min_price, 
      max_price,
      in_stock,
      is_active,
      sort_by, //you can only sort by price , name , created_at and stock
      order, //the order of sorting is it ascending or descending
      limit, //the limit of products per request
      offset //when to start returning products
    } = req.query;
    const user_id = req.user?.user_id;

    
    if(product_id){ //if user provides product_id validate the id return false if id not valid
      const idValidation = commonRepo.validateId(product_id);
      if(!idValidation.valid) return res.status(400).json("Product ID Is Invalid")
      const product = await productsRepo.getProductById(product_id , user_id);
      if(product === undefined) return res.status(404).json("Product Doesn't Exist");
    else return res.status(200).json(product);

    }
    

     // --- Build WHERE conditions dynamically ---
    const conditions = []; //sql conditions will seperate it by AND in the end
    const params = []; //query filters sent by user , will add them if exists

    // 1. Category filter
    const categoryValidation = commonRepo.validateId(category_id);
    if (categoryValidation.valid) {
      const category = await categoryRepo.getCategoryById(category_id)
      if(category === undefined ) return res.status(400).json('Category ID Is Invalid')
      conditions.push('p.category_id = UUID_TO_BIN(?)');
      params.push(category_id);
    }

    // 2. Search filter (name or description)
    if (search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
        // 3. Price range
    if (min_price) {
      conditions.push('p.price >= ?');
      params.push(Number(min_price));
    }
    if (max_price) {
      conditions.push('p.price <= ?');
      params.push(Number(max_price));
    }

    // 4. Stock filter
    if (in_stock) {
      if(in_stock === 'false') conditions.push('p.stock = 0');
      else conditions.push('p.stock > 0');
      
    }

    // 5. Active status (optional, maybe admins see inactive)
    if (is_active === 'true') {
      conditions.push('p.is_active = 1');
    } else if (is_active === 'false') {
      conditions.push('p.is_active = 0');
    }
     
    const whereClause = conditions.length > 0  //if atleast 1 condition exists write WHERE and join the conditions in a string else dont use where
      ? 'WHERE ' + conditions.join(' AND ') 
      : '';

    // --- Sorting (whitelist allowed columns) ---
    const allowedSort = { //this prevents sql injection as the user can only send sort_by = these 4 parameters
      price: 'p.price',
      name: 'p.name',
      created_at: 'p.created_at',
      stock: 'p.stock'
    };
    const sortColumn = allowedSort[sort_by] || 'p.created_at'; // default newest first if sort_by is undefined
    const sortOrder = order && order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'; //default is sorting in descending order if user didnt specify

    // --- Pagination ---
    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 100); //limits the number of products sent to min 1 and max 100
    const pageOffset = Math.max(parseInt(offset, 12) || 0, 0);//makes sure the if the offset is undefined default it to 10
        const products = await productsRepo.getProductsByFilter(whereClause , sortColumn , sortOrder , params , user_id , pageLimit , pageOffset);
        if(products === undefined) return res.status(200).json([])
        const count = await productsRepo.getCount(whereClause , params);
          return res.status(200).json({products , count});
    } catch(err){
        console.error("Error Fetching Products"  , err);
        res.status(500).json("Internal Server Error");
    }
});









module.exports = router;