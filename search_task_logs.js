import fs from 'node:fs';
import path from 'node:path';

const tasksDir = 'C:\\Users\\hossa\\.gemini\\antigravity\\brain\\9028d0d0-4cb5-44f7-bf6d-d602dfd5b579\\.system_generated\\tasks';

async function searchTaskLogs() {
  console.log('=== SEARCHING SYSTEM TASK LOGS FOR JOB DELETIONS ===\n');

  if (!fs.existsSync(tasksDir)) {
    console.error('Tasks directory not found:', tasksDir);
    return;
  }

  const files = fs.readdirSync(tasksDir);
  console.log(`Found ${files.length} task log files. Searching...\n`);

  for (const f of files) {
    if (!f.endsWith('.log')) continue;
    const fullPath = path.join(tasksDir, f);
    const content = fs.readFileSync(fullPath, 'utf-8');

    if (content.includes('/api/jobs/') || content.includes('DELETE') || content.includes('20:30:') || content.includes('20:31:')) {
      const matchingLines = content
        .split('\n')
        .filter(l => l.includes('DELETE') || l.includes('/api/jobs/') || l.includes('20:30:') || l.includes('20:31:') || l.includes('Job Change'));
      
      if (matchingLines.length > 0) {
        console.log(`File: ${f}`);
        matchingLines.forEach(l => console.log(`  ${l.substring(0, 200)}`));
        console.log('');
      }
    }
  }
}

searchTaskLogs().catch(err => console.error(err));
