import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);

console.log('Current ai_providers table:');
const rows = db.prepare('SELECT * FROM ai_providers').all();
console.log(JSON.stringify(rows, null, 2));

// Ensure Google Gemini active provider model_name is set to a valid model ('gemini-2.5-flash')
db.prepare("UPDATE ai_providers SET model_name = 'gemini-2.5-flash' WHERE provider_name = 'Google Gemini'").run();

console.log('\nUpdated Google Gemini model_name in DB to "gemini-2.5-flash".');
const updatedRows = db.prepare('SELECT * FROM ai_providers').all();
console.log(JSON.stringify(updatedRows, null, 2));
