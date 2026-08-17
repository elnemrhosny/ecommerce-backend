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





    module.exports = {validateId , validateName };