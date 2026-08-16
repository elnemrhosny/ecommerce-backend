// routes/checkout.js
const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const pool = require('../db');
const cartsRepo = require('../functions/carts');
const ordersRepo = require('../functions/orders');
const authenticationRepo = require('../functions/authentication');

// POST /checkout/create-session
router.post('/create-session', authenticationRepo.authenticateUser, authenticationRepo.cartIdentifier , async (req, res) => {
  try {
    const { user_id , email_verified}= req.user;
    if(!email_verified) return res.status(403).json('Please verify your email');
    const cart_id = req.cart_id

    // 1. Fetch cart items for the authenticated user
    const cart = await cartsRepo.getCartById(cart_id);

    if (cart.items.length === 0) {
      return res.status(400).json("Cart Is Empty");
    }

    // 2. Prepare line items for Stripe
    const lineItems = cart.items.map(item => ({
      price_data: {
        currency: 'usd',                // change to your currency
        product_data: { name: item.name },
        unit_amount:Math.round(Number(item.price) * 100)// Stripe expects cents
      },
      quantity: item.quantity,
    }));

    // 3. Create a new order in your DB with status 'pending'
    const order_id = await ordersRepo.createOrder(user_id , cart.total_price);
    if(order_id === undefined) return res.status(500).json("Order Creation Failed Please Contact Your Adminstrator");
    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${process.env.CLIENT_URL}/order-success`,
      cancel_url: `${process.env.CLIENT_URL}/cart`,
      metadata: {
        order_id: order_id, 
        cart_id : cart_id  // to link webhook with your order
      },
    });

    // 5. Save the Stripe session ID in your order (optional but helpful for debugging)
    await pool.query(
      'UPDATE orders SET payment_method = ? WHERE id = UUID_TO_BIN(?)',
      [session.id, order_id]
    );

    await ordersRepo.createOrderItems(cart , order_id);
    const orderItems = await ordersRepo.getOrderItems(order_id);
    // 6. Return the checkout URL to the frontend
    return res.json({url: session.url , orderItems});

  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json("Internal Server Error");
  }
});

module.exports = router;