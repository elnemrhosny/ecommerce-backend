const axios = require('axios');

const PAYMOB_API_BASE = 'https://accept.paymob.com'; // sandbox

async function createIntention(orderId, amountCents , items, user ,currency = 'EGP') {
  const response = await axios.post(
    `${PAYMOB_API_BASE}/v1/intention/`,
    {
      amount: amountCents,
      currency,
      items ,
      payment_methods: [Number(process.env.PAYMOB_CARD_INTEGRATION_ID)], // or include wallet ID if needed
      special_reference: orderId, // store your internal order ID
      user_id : user.user_id,
      notification_url: `${process.env.BACKEND_URL}/checkout/callback`, // webhook
      redirection_url:`${process.env.CLIENT_URL}/order-success` ,
      billing_data : {
        first_name : user.name || '' , 
        last_name : user.name || 'user' ,
        phone_number : user.phone || '55555555' , 
        email : user.email
      }
    },
    {
      headers: {
        'Authorization': `Token ${process.env.PAYMOB_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
}

function buildPaymobItems(cartItems) {
  return cartItems.map(i => ({
    name: i.name.slice(0, 50),
    amount: Math.round(Number(i.price) * 100), // cents, per unit price * qty
    description: i.description?.slice(0, 255),
    quantity: i.quantity,
  }));
}

module.exports = { createIntention , buildPaymobItems };