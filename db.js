// db.js

const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl : {
    ca : fs.readFileSync(require('path').join(__dirname, 'config/ca.pem')) ,
    rejectUnauthorized : true,
  }
  // Ensure proper handling of binary UUIDs
  // (mysql2 with binary types works fine; we use MySQL functions for conversion)
});

module.exports = pool;