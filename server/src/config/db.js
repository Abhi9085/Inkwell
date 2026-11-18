
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  max: Number.parseInt(process.env.PG_POOL_MAX || "5", 10),

  idleTimeoutMillis: Number.parseInt(
    process.env.PG_IDLE_TIMEOUT_MS || "30000",
    10
  ),

  connectionTimeoutMillis: Number.parseInt(
    process.env.PG_CONNECT_TIMEOUT_MS || "10000",
    10
  ),

  statement_timeout: Number.parseInt(
    process.env.PG_STATEMENT_TIMEOUT_MS || "15000",
    10
  ),

  application_name: "inkwell-api",
});

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error:", error);
});

module.exports = pool;
