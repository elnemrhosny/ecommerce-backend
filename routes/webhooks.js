const express = require('express');
const router = express.Router();
const pool = require('../db');
const ordersRepo = require('../functions/orders');
const cartsRepo = require('../functions/carts');
const crypto = require('crypto');


function verifyPaymobHMAC(payload, hmacReceived) {
  const keys = Object.keys(payload).sort();
  const concatenated = keys.map(key => payload[key]).join('');
  const hmac = crypto.createHmac('sha512', process.env.PAYMOB_HMAC_SECRET).update(concatenated).digest('hex');
  return hmac === hmacReceived;
}
router.post('/callback', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
    const { obj, type, hmac } = req.body;
    if (!verifyPaymobHMAC(req.body, hmac)) {
      console.error('Invalid HMAC');
      return res.status(400).send('Invalid signature');
    }

    // Only trust the Transaction Processed callback
    if (type === 'TRANSACTION' && obj.success === true) {
      const orderId = obj.special_reference; // or obj.order.id if you stored differently
      const txnId = obj.id;
      // Update order status to paid
      await ordersRepo.updatePaymentStatus(orderId, 'paid');
      // Move cart items to order_items if not already done
      // await ordersRepo.createOrderItemsFromCart(orderId);
      // Clear cart
      // await cartsRepo.clearCart(orderId);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
  
});

module.exports = router;