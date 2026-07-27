import fs from 'fs';
import path from 'path';

const file = 'C:\\Users\\hossa\\.gemini\\antigravity\\brain\\ed8c329b-ed14-4802-8f3c-6be4360a1eb4\\.system_generated\\logs\\transcript_full.jsonl';

if (fs.existsSync(file)) {
  const text = fs.readFileSync(file, 'utf-8');
  console.log('Transcript length:', text.length);
  const idx = text.indexOf('احفظ العمل حتى هذه النقطة');
  console.log('Index of Checkpoint 1 text:', idx);
  
  if (idx !== -1) {
    const textBeforeCheckpoint = text.slice(0, idx);
    console.log('Text before checkpoint length:', textBeforeCheckpoint.length);
  }
} else {
  console.log('Transcript file not found:', file);
}
