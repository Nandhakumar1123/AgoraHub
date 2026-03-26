const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'db_mini',
    password: process.env.DB_PASSWORD || 'nandha102',
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function checkPetitionsSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns
            WHERE table_name = 'petitions'
            ORDER BY ordinal_position;
        `);
        console.log('PETITIONS_COLUMNS_START');
        result.rows.forEach(row => {
            console.log(`${row.column_name}|${row.is_nullable}|${row.data_type}`);
        });
        console.log('PETITIONS_COLUMNS_END');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkPetitionsSchema();
