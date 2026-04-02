const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

(async () => {
    try {
        const db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });
        console.log("Checking push_subscriptions table...");
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'");
        
        if (tables.length === 0) {
            console.log("Creating push_subscriptions table...");
            await db.exec(`
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    username TEXT PRIMARY KEY,
                    subscription TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log("Migration successful.");
        } else {
            console.log("Table exists.");
        }
        process.exit(0);
    } catch (e) {
        console.error("Migration error:", e.message);
        process.exit(1);
    }
})();
