const Joi = require('joi');
const pool = require('../db')
const  commonRepo= require('./common');
const {randomUUID} = require('crypto');

const quantitySchema = Joi.number().integer().min(1).required().messages({
      'number.base': 'Quantity must be a number',
      'number.min': 'Quantity cannot be negative',
      'any.required': 'Quantity is required'
})



const validateQuantity = function(quantity){
    return runValidation(quantitySchema ,quantity)
}


const calculateTotalPrice = function(items){
    let total_price = 0;
    for(let x of items) total_price = total_price + Number(x.total_price);
    return total_price.toFixed(2);
}

const runValidation = function(schema , data){
   
    const { error } = schema.validate(data , {abortEarly : false});
    const validation = {
        valid : !error , 
        messages : error ? error.details.map(d => d.message) : []
        }
    return validation;
}

async function getCartIdByUserId(user_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS cart_id FROM carts WHERE user_id = UUID_TO_BIN(?)' , [user_id]); //get cart of user
    if(result.length === 0) return undefined;
    return result[0];
}

async function createUserCart(user_id){
    const newId = randomUUID();
    const [result] = await pool.query('INSERT INTO carts (id , user_id) VALUES(UUID_TO_BIN(?) , UUID_TO_BIN(?))' , [newId , user_id]);
    if(result.length === 0) return undefined;
    return newId;
}

async function createGuestCart(){
    const newId = randomUUID();
    const [result] = await pool.query('INSERT INTO carts(id , user_id) VALUES(UUID_TO_BIN(?) , NULL)' , [newId]);
    if(result.length === 0) return undefined;
    return newId;
}

async function checkGuestCartById(cart_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS cart_id FROM carts WHERE id = UUID_TO_BIN(?) AND user_id IS NULL' , [cart_id]);
    if(result.length === 0) return undefined;
    return result[0];
}

async function getCartById(cart_id){
    const [result] = await pool.query(`SELECT BIN_TO_UUID(ci.id) AS item_id ,  BIN_TO_UUID(p.id) AS product_id , ci.quantity ,  p.name , p.description , p.price , p.image_url , (quantity * price) as total_price FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.cart_id = UUID_TO_BIN(?)` , [cart_id]);
    const total_price = calculateTotalPrice(result); //getting items from the cart
    const items = result;
    return {
        cart_id : cart_id , 
        items : items , 
        total_price : total_price
    };
}

async function checkProductExistInCart(cart_id , product_id){ //this is for add item (because add item requires product id) only usually use getItemById to check if an item exist in cart
    const [result] = await pool.query(`SELECT id FROM cart_items WHERE cart_id = UUID_TO_BIN(?) AND product_id = UUID_TO_BIN(?)` , [cart_id , product_id])
    if(result.length === 0) return undefined;
    return true;
}

async function addItem(cart_id , product_id){
    const newId = randomUUID();
    const [result] =  await pool.query('INSERT INTO cart_items ( id , cart_id , product_id , quantity) VALUES (UUID_TO_BIN(?) , UUID_TO_BIN(?) , UUID_TO_BIN(?) , ?)' , [newId , cart_id ,product_id , 1]); //if all checks pass create the item in the cart
    if(result.affectedRows === 0) return undefined;
    return newId;
}

async function deleteItem(item_id , cart_id){
    const [result] = await pool.query('DELETE FROM cart_items WHERE id = UUID_TO_BIN(?) AND cart_id = UUID_TO_BIN(?)' , [item_id , cart_id]);
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function getItemById(item_id , cart_id){
    const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS item_id , BIN_TO_UUID(product_id) AS product_id from cart_items WHERE id = UUID_TO_BIN(?) AND cart_id = UUID_TO_BIN(?)' , [item_id , cart_id]);
    if(result.length === 0) return undefined;
    return result[0];
}

async function updateQuantity(item_id , cart_id , quantity){
    const [result] = await pool.query('UPDATE cart_items SET quantity = ? WHERE id = UUID_TO_BIN(?) AND cart_id = UUID_TO_BIN(?)' , [quantity , item_id , cart_id]);
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function clearCart(cart_id){
   const [result] =  await pool.query(
        'DELETE FROM cart_items WHERE cart_id = UUID_TO_BIN(?)',
        [cart_id]
      );
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function clearCartByOrderId(order_id){
    const [user] =  await pool.query(
        'SELECT BIN_TO_UUID(user_id) AS user_id FROM orders WHERE order_id = UUID_TO_BIN(?)',
        [order_id]
      );
    const cart_id = await getCartIdByUserId(user[0].user_id);
    const result = await clearCart(cart_id);
    if(result === undefined) return undefined;
    return true;
}







module.exports = {
    calculateTotalPrice , 
    validateQuantity , 
    getCartIdByUserId ,
    createUserCart , 
    checkGuestCartById , 
    createGuestCart , 
    getCartById , 
    checkProductExistInCart , 
    addItem , 
    getItemById , 
    deleteItem , 
    updateQuantity , 
    clearCart ,
    clearCartByOrderId
}