const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const pool = require('../db');
const ordersRepo = require('../functions/orders');
const cartsRepo = require('../functions/carts');

// This route must use express.raw() to get the raw body for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const {order_id , cart_id} = session.metadata;
    if (!order_id || !cart_id) {
    console.log('Skipping event: No order_id/cart_id in metadata (likely a Stripe test event)');
    return res.status(200).json({recieved : true });
}
    console.log('Fulfilling order:', order_id);

    try {
      // 1. Update order payment status
      await ordersRepo.updatePaymentStatus(order_id);

      // 2. Get the order's user_id (binary)
      const [[order]] = await pool.query(
        'SELECT user_id FROM orders WHERE id = UUID_TO_BIN(?)',
        [order_id]
      );
        if (!order) {
        console.error('Order not found:', order_id);
        return res.status(200).json({recieved : true });
      }

      // 5. Clear the user's cart
      
      await cartsRepo.clearCart(cart_id);
      await ordersRepo.changeStock(order_id);
      console.log(`Order ${order_id} fulfilled.`);
      return res.status(200).json({recieved : true  });

    } catch (err) {
        console.error('Order fulfillment error:', err);
        return res.status(200).json({recieved : true });
      
      // Always return 200 to avoid Stripe retries
    }
  }
     return res.status(200).json({recieved : true });
  
});

module.exports = router;