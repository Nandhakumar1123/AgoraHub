const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "db_mini",
    password: "nandha102",
    port: 5432,
});

async function checkColumns() {
    try {
        console.log('=== COMPLAINTS COLUMNS ===');
        const complaintsCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'complaints';
    `);
        console.log(complaintsCols.rows);

        console.log('\n=== PETITIONS COLUMNS ===');
        const petitionsCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'petitions';
    `);
        console.log(petitionsCols.rows);

        console.log('\n=== COMPLAINTS STATUSES ===');
        const complaintsStatuses = await pool.query('SELECT DISTINCT status FROM complaints;');
        console.log(complaintsStatuses.rows);

        console.log('\n=== PETITIONS STATUSES ===');
        const petitionsStatuses = await pool.query('SELECT DISTINCT status FROM petitions;');
        console.log(petitionsStatuses.rows);

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await pool.end();
    }
}

checkColumns();
