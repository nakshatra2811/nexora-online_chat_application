const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log("Checking PostgreSQL Users...");
        const res = await pool.query('SELECT username, email, full_name, role FROM users LIMIT 10');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error("Database check FAILED:", err.message);
        process.exit(1);
    }
})();
