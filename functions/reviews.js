const Joi = require('joi');
const {randomUUID} = require('crypto');
const pool  = require('../db');

const reviewAddSchema = Joi.object({ //using joi library to validate the entry review 
    review_id: Joi.forbidden()
    .messages({
      'any.required': 'Cannot add ID'
    }),
    user_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Valid user ID (UUID) is required',
      'any.required': 'user ID is required', 
      'string.base': 'user ID must be a string',
     
    }),

  product_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Valid product ID (UUID) is required',
      'any.required': 'product ID is required', 
      'string.base': 'product ID must be a string',
     
    }),

  comment: Joi.string().trim().allow('').default('').messages({
    'string.base': 'Comment must be a string',
  }) ,

  rating: Joi.number().min(0).max(5).required()
    .messages({
      'number.base': 'Rating must be a number',
      'number.min': 'Rating cannot be negative',
      'number.max': 'Rating cannot be more than 5',
      'any.required': 'Rating is required'
    }),

}).required().messages({
    'any.required': 'Review cant be null or undefined',
});


const reviewUpdateSchema = Joi.object({ //using joi library to validate the entry review 
    review_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Valid review ID (UUID) is required',
      'any.required': 'review ID is required', 
      'string.base': 'review ID must be a string',
    }),
    user_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Valid user ID (UUID) is required',
      'any.required': 'user ID is required', 
      'string.base': 'user ID must be a string',
     
    }),

  comment: Joi.string().trim().allow('').messages({
    'string.base': 'Comment must be a string',
  }) ,

  rating: Joi.number().min(0).max(5)
    .messages({
      'number.base': 'Rating must be a number',
      'number.min': 'Rating cannot be negative',
      'number.max': 'Rating cannot be more than 5',
      'any.required': 'Rating is required'
    }),

}).required().messages({
    'any.required': 'Review cant be null or undefined',
});



const validateReviewAdd = function(review){
    return runValidation(reviewAddSchema , review);
}
const validateReviewUpdate = function(review){
    return runValidation(reviewUpdateSchema , review);
}



reviewAddSchema.validate


const runValidation = function(schema , data){
     const { error , value} = schema.validate(data , {abortEarly : false});
     const validation = {
        data : value,
        valid : !error , 
        messages : error ? error.details.map(d => d.message) : []
        }
    return validation;
}


async function addReview(review, user_id , product_id){
    const newId = randomUUID();
    const params = [newId , product_id , user_id , review.rating , review.comment];
    const [result] = await pool.query('INSERT INTO reviews (id , product_id , user_id , rating , comment) VALUES (UUID_TO_BIN(?) , UUID_TO_BIN(?) , UUID_TO_BIN(?) , ? , ?)' , params);
    if(result.affectedRows === 0) return undefined;
    return newId;
}

async function getReviewById(review_id , user_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS review_id , BIN_TO_UUID(user_id) AS user_id , BIN_TO_UUID(product_id) AS product_id , rating , comment FROM reviews WHERE id = UUID_TO_BIN(?) AND user_id = UUID_TO_BIN(?)' , [review_id ,  user_id]);
    if(result.length === 0) return undefined;
    return result[0];
}

async function getReviewsByProduct(product_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS review_id , BIN_TO_UUID(user_id) AS user_id , BIN_TO_UUID(product_id) AS product_id , rating , comment FROM reviews WHERE product_id = UUID_TO_BIN(?)' , [product_id]);
    return result;
}

async function getReviewsByUser(user_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS review_id , BIN_TO_UUID(user_id) AS user_id , BIN_TO_UUID(product_id) AS product_id , rating , comment FROM reviews WHERE user_id = UUID_TO_BIN(?)' , [user_id]);
    return result;
}

async function deleteReview(review_id , user_id){
    const [result] = await pool.query('DELETE FROM reviews WHERE id = UUID_TO_BIN(?) AND user_id = UUID_TO_BIN(?)' , [review_id , user_id]);
    if(result.affectedRows === 0) return undefined
    return true;
}

async function updateReview(conditions , params , review_id , user_id){
    const query = 'UPDATE reviews SET ' + conditions.join(' , ') + 'WHERE id = UUID_TO_BIN(?) AND user_id = UUID_TO_BIN(?) ';
    const [result] = await pool.query(query , [...params, review_id , user_id]);
    if(result.changedRows === 0) return undefined
    return true;
}




module.exports = {
    validateReviewAdd , 
    validateReviewUpdate,
    addReview , 
    getReviewsByProduct,
    getReviewsByUser , 
    deleteReview , 
    getReviewById , 
    updateReview
}