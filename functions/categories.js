const Joi = require('joi');
const pool = require('../db')
const commonRepo = require('../functions/common');
const {randomUUID} = require('crypto');
const { cloudinary } = require('../middlewares/upload');

const categoryAddSchema = Joi.object({ //using joi library to validate the entry product 
    category_id: Joi.forbidden()
    .messages({
      'any.required': 'Cannot add ID'
    }),
  name: Joi.string().trim().min(1).required()
    .messages({
      'string.empty': 'Category name is required',
      'any.required': 'Category name is required',
      'string.base': 'name must be a string'
    }),
  description: Joi.string().trim().allow('').required().messages({
    'any.required': 'Description is required' , 
    'string.base': 'Description must be a string',
  }) ,
  image_url: Joi.string().uri().allow('').default('')
}).required().messages({
    'any.required': 'Value cant be null or undefined',
});

const descriptionSchema = Joi.string().trim().allow('').required().messages({
    'any.required': 'Description is required'
    });
const imageUrlSchema = Joi.string().uri().allow('').required();


function validateCategoryAdd(category){
    return runValidation(categoryAddSchema , category)
}

function validateDescription(description){
    return runValidation(descriptionSchema , description);
}
function validateImageUrl(image_url){
    return runValidation(imageUrlSchema , image_url);
}

const runValidation = function(schema , data){
     const { error } = schema.validate(data , {abortEarly : false});
     const validation = {
        valid : !error , 
        messages : error ? error.details.map(d => d.message) : []
        }
    return validation;
}


//db queries
async function getCategoryById(category_id){
  const [category] = await pool.query('SELECT BIN_TO_UUID(id) as category_id , name , description , image_url , image_public_id FROM categories WHERE id = UUID_TO_BIN(?)' , [category_id]);
  if(category.length === 0) return undefined;

  return category[0];
}

async function getCategoryByName(name){
  const [result] = await pool.query('SELECT BIN_TO_UUID(id) as category_id , name , description , image_url , image_public_id FROM categories WHERE name = ?' , [name]);
  if(result.length === 0) return undefined;
  return result[0];
}

async function getAllCategories(){
  const [result] = await pool.query('SELECT BIN_TO_UUID(id) as category_id , name , description , image_url , image_public_id FROM categories');
  if(result.length === 0 ) return undefined;
  return result;
}

async function createCategory(category){
  const newId = randomUUID();
  const params = [newId , category.name , category.description , category.image_url ?? null , category.image_public_id ?? null]
  const [result] = await pool.query('INSERT INTO categories (id , name , description , image_url , image_public_id) VALUES (UUID_TO_BIN(?), ? , ? , ? , ?)' , params);
  if(result.affectedRows === 0) return undefined;
  return newId;
}

async function updateCategory(conditions , params){
  const sql = 'UPDATE categories SET ' + conditions.join(' , ') + ' WHERE id = UUID_TO_BIN(?)'; //create the query
  const [result] = await pool.query(sql , params);
  if(result.affectedRows === 0) return undefined;
  return true;

}

async function deleteCategory(category_id){
  const [result] = await pool.query('DELETE FROM categories WHERE id = UUID_TO_BIN(?)' , [category_id]);
  if(result.affectedRows === 0) return undefined;
  return true;

}

async function addImage(category_id , image_url , public_id){
  const [result] = await pool.query('UPDATE categories SET image_url = ? , image_public_id = ? WHERE id = UUID_TO_BIN(?)' , [image_url, public_id, category_id]);
  if(result.affectedRows === 0) return undefined;
  return true;

}

async function deleteImage(category_id) {
  const category = await getCategoryById(category_id);
  if (!category) return undefined;

  // Delete from Cloudinary if public_id exists
  if (category.image_public_id) {
    try {
      await cloudinary.uploader.destroy(category.image_public_id);
    } catch (err) {
      console.error('Cloudinary delete failed:', err);
    }
  }

  // Clear database fields
  const [result] = await pool.query(
    'UPDATE categories SET image_url = NULL, image_public_id = NULL WHERE id = UUID_TO_BIN(?)',
    [category_id]
  );
  return result.affectedRows > 0 ? true : undefined;
}
module.exports = { validateDescription  ,
  validateImageUrl ,
  validateCategoryAdd , 
  getCategoryById , 
  getAllCategories , 
  getCategoryByName , 
  createCategory , 
  updateCategory , 
  deleteCategory , 
  addImage , 
  deleteImage
  }