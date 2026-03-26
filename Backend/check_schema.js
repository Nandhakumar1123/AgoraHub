const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'db_mini',
    password: process.env.DB_PASSWORD || 'nandha102',
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function checkSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns
            WHERE table_name = 'petitions'
            ORDER BY ordinal_position;
        `);
        console.log('Columns in petitions table:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
        });
        
        const complaintResult = await pool.query(`
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns
            WHERE table_name = 'complaints'
            ORDER BY ordinal_position;
        `);
        console.log('\nColumns in complaints table:');
        complaintResult.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error checking schema:', error);
        process.exit(1);
    }
}

checkSchema();
