import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function run() {
  try {
    // 1. Rename existing 'CRITICAL', 'HIGH', 'MODERATE', 'LOW' in alerts table to 'RISK_CRITICAL' etc. if they exist
    await sql`UPDATE alerts SET alert_type = 'RISK_CRITICAL' WHERE alert_type = 'CRITICAL'`;
    await sql`UPDATE alerts SET alert_type = 'RISK_HIGH' WHERE alert_type = 'HIGH'`;
    await sql`UPDATE alerts SET alert_type = 'RISK_MODERATE' WHERE alert_type = 'MODERATE'`;
    await sql`UPDATE alerts SET alert_type = 'RISK_LOW' WHERE alert_type = 'LOW'`;
    
    // 2. Drop the constraint if it exists (for idempotency)
    try {
      await sql`ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check`;
    } catch (e) {
      console.log('Constraint does not exist or could not be dropped, proceeding...');
    }

    // 3. Add the check constraint
    await sql`
      ALTER TABLE alerts ADD CONSTRAINT alerts_alert_type_check 
      CHECK (alert_type IN (
        'RISK_CRITICAL', 'RISK_HIGH', 'RISK_MODERATE', 'RISK_LOW',
        'RESULT_READY', 'ABNORMAL_RESULT', 'CRITICAL_RESULT',
        'NEW_LAB_ORDER',
        'PATIENT_ASSIGNED', 'PRIMARY_TRANSFERRED',
        'OVERAGE_STARTED'
      ))
    `;
    console.log('Successfully updated alerts table constraint!');
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
}

run();
