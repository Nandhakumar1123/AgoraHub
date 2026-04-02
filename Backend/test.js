require('dotenv').config(); 
const { Pool } = require('pg'); 
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
}); 
pool.query("SELECT * FROM memberships").then(res => { console.log(JSON.stringify(res.rows, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })
