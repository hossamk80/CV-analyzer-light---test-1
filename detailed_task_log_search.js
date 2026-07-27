import fs from 'node:fs';
import path from 'node:path';

const tasksDir = 'C:\\Users\\hossa\\.gemini\\antigravity\\brain\\9028d0d0-4cb5-44f7-bf6d-d602dfd5b579\\.system_generated\\tasks';

async function detailedSearch() {
  console.log('=== DETAILED TASK LOG SEARCH FOR DELETION TIMESTAMPS ===\n');

  const files = fs.readdirSync(tasksDir);

  for (const f of files) {
    if (!f.endsWith('.log')) continue;
    const fullPath = path.join(tasksDir, f);
    const content = fs.readFileSync(fullPath, 'utf-8');

    if (content.includes('20:23:') || content.includes('20:30:') || content.includes('20:31:') || content.includes('DELETE /api/jobs/')) {
      console.log(`Task Log: ${f}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('20:23:') || line.includes('20:30:') || line.includes('20:31:') || line.includes('DELETE /api/jobs/')) {
          console.log(`  Line ${idx+1}: ${line.substring(0, 250)}`);
        }
      });
      console.log('---');
    }
  }
}

detailedSearch().catch(err => console.error(err));
