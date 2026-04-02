const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'db_mini', password: 'nandha102', port: 5432 });

async function check() {
    try {
        const comms = await pool.query("SELECT community_id, name, is_archived FROM communities");
        console.log('COMMUNITIES:', JSON.stringify(comms.rows, null, 2));
        
        const memberships = await pool.query("SELECT membership_id, user_id, community_id, status FROM memberships WHERE status = 'ARCHIVED'");
        console.log('ARCHIVED MEMBERSHIPS:', JSON.stringify(memberships.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();
