const { Pool } = require("pg");
require("dotenv").config();

function buildSsl() {
  const raw = process.env.DB_SSL || "";
  const enabled =
    raw.toLowerCase() === "true" || raw === "1" || raw.toLowerCase() === "yes";
  if (!enabled) return undefined;

  // Supabase requires SSL; rejectUnauthorized=false is common for managed DBs
  // where the server cert chain might not match local trust stores.
  return { rejectUnauthorized: false };
}

const ssl = buildSsl();
const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl,
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      ssl,
    });

module.exports = { pool };

