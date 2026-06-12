import postgres from 'postgres';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function migrate() {
    try {
        console.log('Running add_subscription_change_tokens.sql...');
        const migration = fs.readFileSync('migrations/add_subscription_change_tokens.sql', 'utf8');
        await sql.unsafe(migration);
        console.log('Migration applied successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}
migrate();
