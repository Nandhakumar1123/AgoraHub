const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "db_mini",
    password: process.env.DB_PASSWORD || "nandha102",
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function check() {
    try {
        const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'complaints'::regclass;
    `);
        console.log('Complaints Constraints:');
        res.rows.forEach(row => console.log(`${row.conname}: ${row.pg_get_constraintdef}`));

        const res2 = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'petitions'::regclass;
    `);
        console.log('\nPetitions Constraints:');
        res2.rows.forEach(row => console.log(`${row.conname}: ${row.pg_get_constraintdef}`));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
