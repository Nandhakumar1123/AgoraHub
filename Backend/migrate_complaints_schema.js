const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "db_mini",
    password: "nandha102",
    port: 5432,
});

async function migrate() {
    try {
        console.log('=== STARTING MIGRATION ===');

        // 1. Add missing columns
        console.log('Adding missing columns to complaints table...');
        await pool.query(`
      ALTER TABLE complaints 
      ADD COLUMN IF NOT EXISTS remarks TEXT,
      ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(user_id),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
        console.log('✅ Columns added.');

        // 2. Check for existing status constraint
        const constraintCheck = await pool.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'complaints'::regclass AND conname LIKE '%status%';
    `);

        if (constraintCheck.rows.length > 0) {
            console.log('Dropping existing status constraint:', constraintCheck.rows[0].conname);
            await pool.query(`ALTER TABLE complaints DROP CONSTRAINT ${constraintCheck.rows[0].conname};`);
        }

        // 3. Add new status constraint or just let it be flexible
        // The previous constraint was: CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
        // New required statuses from frontend: 'Pending', 'Approved', 'Rejected'
        // Let's make it flexible for now or include all.
        console.log('Adding updated status constraint...');
        await pool.query(`
      ALTER TABLE complaints 
      ADD CONSTRAINT complaints_status_check 
      CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'Pending', 'Approved', 'Rejected'));
    `);
        console.log('✅ Status constraint updated.');

        console.log('=== MIGRATION COMPLETED ===');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
