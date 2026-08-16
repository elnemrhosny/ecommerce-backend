const Joi = require('joi');

const idSchema = Joi.string().uuid().required().messages({
        'string.base': 'ID must be a string',
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required'
    });
const nameSchema = Joi.string().trim().min(3).required()
    .messages({
      'string.empty': 'Name is required',
      'any.required': 'Name is required',
      'string.base' : 'Name must be a string' , 
      'string.min' : 'Name must be more than 3 characters'
    });


function validateId(id){
    return runValidation(idSchema , id);
}
function validateName(name){
    return runValidation(nameSchema , name);
}


const runValidation = function(schema , data){
     const { error } = schema.validate(data , {abortEarly : false});
     const validation = {
        valid : !error , 
        messages : error ? error.details.map(d => d.message) : []
        }
    return validation;
}


const getObjectWithUrl = (obj) => ({...obj , image_url :obj.image_url  ? `${process.env.BACKEND_URL}${obj.image_url}` : null})
const getArrayWithUrl = (arr) =>{
    const newArr = arr.map(x =>({
    ...x ,
    image_url : x.image_url ?  `${process.env.BACKEND_URL}${x.image_url}` : null
  }))
  return newArr
}
const getArrayOfUrls = (arr) => arr.map(x =>{
    return {
        image_id : x.image_id,
        image_url : `${process.env.BACKEND_URL}${x.image_url}`
    }
})



    module.exports = {validateId , validateName , getArrayWithUrl , getObjectWithUrl , getArrayOfUrls};