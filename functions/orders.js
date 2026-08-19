const {randomUUID} = require('crypto');
const pool = require('../db')
const usersRepo = require('./users');


const calculateTotalPrice = function(items){
    let total_price = 0;
    for(let x of items) total_price = total_price + Number(x.product_price);
    return total_price.toFixed(2);
}

const sortOrders = orders =>{
    if(orders?.length === 0) return [];
    const active = [];
    const past = [];
    for(x of orders){
        if(x.order_status === 'pending' || 'confirmed') active.push(x);
        else past.push(x);
    }
    return {active , past};
}

async function createOrder(user_id , total_price){
    const newId = randomUUID();
    const [result] = await pool.query(
      `INSERT INTO orders (id, user_id, total_amount, order_status, payment_status , shipping_address)
       VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, 'pending', 'pending' , 'Moharem Bek')`,
      [newId, user_id, total_price]
    );
    if(result.affectedRows === 0) return undefined;
    return newId;
}

async function createOrderItems(cart , order_id){
    const ids = [];
    for (const item of cart.items) {
        const newId = randomUUID();
        await pool.query(
          `INSERT INTO order_items (id, order_id, product_id, product_name, product_price , product_image_url, quantity)
           VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ? ,?)`,
          [newId , order_id, item.product_id, item.name, item.price, item.image_url , item.quantity]
        );
        ids.push(newId);
      }
    return ids;
}

async function getOrderItems(order_id){
   const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS orderitem_id, BIN_TO_UUID(order_id) AS order_id, BIN_TO_UUID(product_id) AS product_id, product_name, product_price, product_image_url , quantity , subtotal AS total_price FROM order_items WHERE order_id = UUID_TO_BIN(?)' , [order_id]);
   return result;
}
async function getOrderById(order_id){
   const [result] = await pool.query('SELECT BIN_TO_UUID(id) AS order_id, BIN_TO_UUID(user_id) AS user_id, total_amount, order_status, payment_status, shipping_address, created_at FROM orders WHERE id = UUID_TO_BIN(?)' , [order_id]);
   if(result.length === 0) return undefined;
   return result[0];
}


async function updatePaymentStatus(order_id , status = 'paid'){
    await pool.query(
        'UPDATE orders SET payment_status = ? WHERE id = UUID_TO_BIN(?)',
        [status, order_id]
      );

}

async function updateOrderStatus(order_id , status = 'confirmed'){
    await pool.query(
        'UPDATE orders SET order_status = ? WHERE id = UUID_TO_BIN(?)',
        [status, order_id]
      );

}

async function getOrdersByUserId(user_id){
    const [orders] = await pool.query('SELECT BIN_TO_UUID(id) AS order_id , order_status , payment_status , total_amount , created_at FROM orders WHERE user_id =  UUID_TO_BIN(?)' , [user_id]);
    const ordersFinal = [];
    for(const x of orders){
        const [result] = await pool.query('SELECT BIN_TO_UUID(oi.id) AS orderitem_id, BIN_TO_UUID(oi.order_id) AS order_id, BIN_TO_UUID(oi.product_id) AS product_id, oi.product_name, oi.product_price, oi.product_image_url , oi.quantity , oi.subtotal AS total_price FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.user_id = UUID_TO_BIN(?) AND o.id = UUID_TO_BIN(?)' , [user_id , x.order_id]);
        const order = {
            order_id : x.order_id , 
            order_status : x.order_status , 
            payment_status : x.payment_status , 
            total_amount : x.total_amount , 
            created_at : x.created_at , 
            items : result
        }
        ordersFinal.push(order);
    }
   if(ordersFinal.length === 0) return undefined;
   return sortOrders(ordersFinal);
}

async function changeStock(order_id){ //change stock quantities on order success
  const items = await getOrderItems(order_id);
  for(const x of items){
    await pool.query('UPDATE products SET stock = stock - ?  WHERE id = UUID_TO_BIN(?)' , [x.quantity , x.product_id]);
  }
  return true;
}

async function getAllOrders(limit , offset){
     const [orders] = await pool.query('SELECT BIN_TO_UUID(id) AS order_id , order_status , payment_status , total_amount , created_at FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?' , [limit , offset]);
    const ordersFinal = [];
    for(const x of orders){
        const [result] = await pool.query('SELECT BIN_TO_UUID(oi.id) AS orderitem_id, BIN_TO_UUID(oi.order_id) AS order_id, BIN_TO_UUID(oi.product_id) AS product_id, oi.product_name, oi.product_price, oi.product_image_url , oi.quantity , oi.subtotal AS total_price FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.id = UUID_TO_BIN(?)' , [x.order_id]);
        const order = {
            order_id : x.order_id , 
            order_status : x.order_status , 
            payment_status : x.payment_status , 
            total_amount : x.total_amount , 
            created_at : x.created_at , 
            items : result
        }
        ordersFinal.push(order);
    }
   if(ordersFinal.length === 0) return undefined;
   return sortOrders(ordersFinal);
}

async function deleteOrder(order_id){ //change stock quantities on order success
    const [result] = await pool.query('DELETE FROM orders WHERE id = UUID_TO_BIN(?)' , [order_id]);
    if(result.affectedRows === 0) return undefined;
    return true;
}

async function deleteOrderItems(order_id){ //change stock quantities on order success
    const [result] = await pool.query('DELETE FROM order_items WHERE order_id = UUID_TO_BIN(?)' , [order_id]);
    if(result.affectedRows === 0) return undefined;
    return true;
}
 
async function getCount(whereClause, params , user_email) {
     let user_id = null;
    let userClause = '';
    if(user_email){
        const user = await usersRepo.getUserByEmail(user_email);
        if(user === undefined) return undefined; //if user not found return 0 count
        user_id = user?.user_id;
        userClause = user_id ? 'AND user_id = UUID_TO_BIN(?)' : 'AND 1=0'; //if user not found return empty result
    }
    if(user_id) params.push(user_id);
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM orders ${whereClause} ${userClause}`,
    params,
  );
  return count;
}


async function getOrdersByFilter(whereClause, sortColumn, sortOrder, params , limit , offset , user_email) {
    let user_id = null;
    let userClause = '';
    if(user_email){
        const user = await usersRepo.getUserByEmail(user_email);
        if(user === undefined) return undefined; //if user not found return empty result
        user_id = user?.user_id;
        userClause = user_id ? 'AND user_id = UUID_TO_BIN(?)' : 'AND 1=0'; //if user not found return empty result
    }
  const sql = `
      SELECT 
        BIN_TO_UUID(id) AS order_id,
        order_status,
        BIN_TO_UUID(user_id) AS user_id,
        payment_status,
        total_amount,
        created_at
      FROM orders
      ${whereClause} ${userClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    const queryParams = [];
    queryParams.push(...params);
    if(user_id) queryParams.push(user_id); 
    queryParams.push(limit, offset);
  const [orders] = await pool.query(sql, queryParams);
  const ordersFinal = await Promise.all(orders.map(async (x) => {
    const [orderItems, user] = await Promise.all([
        getOrderItems(x.order_id),
        usersRepo.getUserById(x.user_id),
    ]);
    return { ...x, user, items: orderItems };
}));

  return ordersFinal || [];
}

async function getPaymentStatus(order_id){
    const [result] = await pool.query('SELECT payment_status FROM orders WHERE id = UUID_TO_BIN(?)' , [order_id]);
    if(result.length === 0) return undefined;
    return result[0].payment_status;
}



module.exports = {
    calculateTotalPrice,
    createOrder , 
    getOrderById ,
    createOrderItems , 
    getOrderItems , 
    updatePaymentStatus , 
    getOrdersByUserId , 
    changeStock , 
    getAllOrders , 
    deleteOrder , 
    deleteOrderItems , 
    getCount , 
    getOrdersByFilter , 
    updateOrderStatus , 
    getPaymentStatus
}