// routes/checkout.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const cartsRepo = require('../functions/carts');
const ordersRepo = require('../functions/orders');
const authenticationRepo = require('../functions/authentication');
const {createIntention , buildPaymobItems} = require('../functions/paymob');
const crypto = require('crypto');


const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success'
];

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function verifyPaymobHMAC(body, hmacReceived) {
  const obj = body.obj;
  if (!obj || !hmacReceived) return false;

  const concatenated = HMAC_FIELDS.map(field => {
    const value = getNested(obj, field);
    return value === null || value === undefined ? '' : String(value);
  }).join('');

  const hmac = crypto
    .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET)
    .update(concatenated)
    .digest('hex');

  return hmac === hmacReceived;
}

// POST /checkout/create-session
router.post('/create-session', authenticationRepo.authenticateUser, authenticationRepo.cartIdentifier , async (req, res) => {
   try {
    const user_id = req.user.user_id;
    const cart_id = req.cart_id;
    const cart = await cartsRepo.getCartById(cart_id);
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    const paymobItems = buildPaymobItems(cart.items);

    const order_id = await ordersRepo.createOrder(user_id, cart.total_price);
    await ordersRepo.createOrderItems(cart , order_id);
    // 2. Calculate amount in cents (smallest unit). For EGP, 1 pound = 100 piasters.
    const amountCents = paymobItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);

    // 3. Create intention
    const intention = await createIntention(order_id, amountCents , paymobItems , req.user);
    const clientSecret = intention.client_secret;

    // 4. Build the redirect URL (frontend will do this)
    const redirectUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;

    return res.json({ clientSecret, redirectUrl, orderId: order_id });
  } catch (err) {
    console.error('Paymob intention error:', err.response?.data || err.message);
    res.status(500).json('Internal Server Error');
  }
});


router.post('/callback', async (req, res) => {
    try {
    const { obj, type } = req.body;
    const hmac = req.query.hmac;
    const orderId = obj.order.merchant_order_id;
    const items = obj.items;

    if (!verifyPaymobHMAC(req.body, hmac)) {
      await ordersRepo.deleteOrderItems(orderId);
      await ordersRepo.deleteOrder(orderId);
      return res.status(400).send('Invalid signature');
    }
    console.log('Webhook received:', req.body);
    console.log(type === 'TRANSACTION' && obj.success === true);
    // Only trust the Transaction Processed callback
    if (type === 'TRANSACTION' && obj.success === true) {
      await ordersRepo.updatePaymentStatus(orderId, 'paid');
      await cartsRepo.clearCartByOrderId(orderId);
      await ordersRepo.changeStock(orderId);
    
    }else{
      await ordersRepo.deleteOrderItems(orderId);
      await ordersRepo.deleteOrder(orderId);
      return res.status(402).json('Payment failed')
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
  
});

module.exports = router;