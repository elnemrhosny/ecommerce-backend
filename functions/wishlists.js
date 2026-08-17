const pool = require('../db');
const commonRepo = require('./common');

async function addProduct(product_id , user_id){
    const [result] = await pool.query('INSERT INTO wishlists (product_id , user_id) VALUES(UUID_TO_BIN(?) , UUID_TO_BIN(?))' , [product_id , user_id]);
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function deleteProduct(product_id , user_id){
    const [exist] = await pool.query('SELECT product_id FROM wishlists WHERE product_id = UUID_TO_BIN(?) AND user_id = UUID_TO_BIN(?)' , [product_id ,user_id]);
    if(exist.length === 0) return undefined;
    const [result] = await pool.query('DELETE FROM wishlists WHERE product_id = UUID_TO_BIN(?) AND user_id = UUID_TO_BIN(?)' , [product_id , user_id]);
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function getWishlist(user_id , offset = 0 , limit = 12){
    const [result] = await pool.query('SELECT BIN_TO_UUID(p.id) AS product_id , BIN_TO_UUID(p.category_id) as category_id , c.name AS category_name  , p.name , p.slug , p.description , p.price , p.stock , p.is_active , p.image_url , TRUE AS is_wishlisted  FROM products p JOIN categories c ON p.category_id = c.id JOIN wishlists w ON p.id = w.product_id WHERE w.user_id = UUID_TO_BIN(?) LIMIT ? OFFSET ?' , [user_id , limit , offset]);
    if(result.length === 0) return undefined;
    return result;
}

async function getCount(user_id) {
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM wishlists WHERE user_id = UUID_TO_BIN(?)`,
    [user_id],
  );
  return count;
}


module.exports = {
    addProduct , 
    getWishlist , 
    deleteProduct , 
    getCount
}