const express = require("express");
const cors = require("cors"); //allows cross origin http requests
const cookieParser = require('cookie-parser'); //allows us to use cookies
require('dotenv').config(); //loads .env file
const PORT = 8000;
const app = express();
app.set('etag' , false);


//data required should always be in the body of the request except for GET and DELETE requests it should have the input in the form of a query

//this api always returns an object{
//                                  valid : true or false (to check whether the api call was succesfull or not)
//                                  data : this can be an array or object or null if we dont need to send data like deleting a product,
//                                  messages :[] this is an array of messages on faluire to know exactly why the api call failed
//}
app.use(express.json());
const allowedOrigins = [process.env.CLIENT_URL , "http://localhost:5173" , "http://192.168.1.16:5173"]
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(cookieParser());


const productsRoute = require("./routes/products");
const categoriesRoute = require("./routes/categories");
const usersRoute = require("./routes/users");
const cartsRoute = require('./routes/carts');
const wishlistsRoute = require('./routes/wishlists');
const reviewsRoute = require('./routes/reviews');
const ordersRoute = require('./routes/orders');
const checkoutRoute = require('./routes/checkout');
const adminRoute = require('./routes/admin');
app.use("/products" , productsRoute);
app.use("/categories",categoriesRoute);
app.use("/users" , usersRoute);
app.use('/carts' , cartsRoute);
app.use('/wishlists' , wishlistsRoute);
app.use('/reviews' , reviewsRoute);
app.use('/orders' , ordersRoute);
app.use('/checkout' , checkoutRoute);
app.use('/admin' , adminRoute);
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({valid : false ,data : null , messages: ['Invalid JSON in request body. Please check your syntax.'] });
  }
});



app.listen(PORT, () => console.log(`Express is working on ${PORT}`));
