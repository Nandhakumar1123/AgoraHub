// Database Setup Script
// Run this once to create all necessary tables

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "db_mini",
  password: "nandha102",
  port: 5432,
});

async function setupDatabase() {
  try {
    console.log("📦 Setting up database tables...");

    // Read the schema file
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSQL = fs.readFileSync(schemaPath, "utf8");

    // Execute the schema
    await pool.query(schemaSQL);

    console.log("✅ Database tables created successfully!");
    console.log("📋 Tables created:");
    console.log("   - users");
    console.log("   - communities");
    console.log("   - memberships");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up database:", error.message);
    process.exit(1);
  }
}

setupDatabase();

