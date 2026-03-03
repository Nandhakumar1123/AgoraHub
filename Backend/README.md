# Backend Setup Instructions

## Database Setup

The error you're seeing (`relation "memberships" does not exist`) means the database tables haven't been created yet.

### Quick Fix:

1. **Run the database setup script:**
   ```bash
   node setup-database.js
   ```

2. **Or manually run the SQL schema:**
   - Open PostgreSQL (pgAdmin or psql)
   - Connect to your `db_mini` database
   - Run the SQL commands from `schema.sql`

### Database Tables Created:

- `users` - User accounts
- `communities` - Community groups
- `memberships` - User-community relationships

### After Setup:

Start your server:
```bash
node server.js
```

The server should now work without errors!

