import postgres from 'postgres';
import * as fs from 'fs';

const sql = postgres('postgresql://postgres:Missoumhadi1234@db.eofcnxmmuexlqdzllhov.supabase.co:5432/postgres', { ssl: 'require' });

async function migrate() {
    try {
        console.log('Running schema.sql...');
        const schema = fs.readFileSync('schema.sql', 'utf8');
        await sql.unsafe(schema);
        console.log('schema.sql applied successfully.');

        console.log('Running migration_clean.sql...');
        const migration = fs.readFileSync('migration_clean.sql', 'utf8');
        await sql.unsafe(migration);
        console.log('migration_clean.sql applied successfully.');
        
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}
migrate();
