import fs from 'fs';
import path from 'path';

const fullFile = 'C:\\Users\\hossa\\.gemini\\antigravity\\brain\\ed8c329b-ed14-4802-8f3c-6be4360a1eb4\\.system_generated\\logs\\transcript_full.jsonl';
const text = fs.readFileSync(fullFile, 'utf-8');

const checkpointIdx = text.indexOf('احفظ العمل حتى هذه النقطة');
console.log('Checkpoint index:', checkpointIdx);

const beforeCheckpoint = text.slice(0, checkpointIdx);

// Target files to check
const targetFiles = [
  'src/App.tsx',
  'src/components/TopNavbar.tsx',
  'src/views/Dashboard.tsx',
  'src/views/Jobs.tsx',
  'src/views/Upload.tsx',
  'src/views/Results.tsx',
  'src/views/Analytics.tsx',
  'src/views/CandidateDetail.tsx',
  'src/views/Settings.tsx',
  'src/views/PromptSettings.tsx',
  'src/views/Settings/IntegrationsSettings.tsx',
  'src/theme-tokens.css',
  'src/index.css'
];

// Let's parse JSON lines before checkpointIdx
const lines = beforeCheckpoint.split('\n');
console.log(`Parsing ${lines.length} lines before checkpoint...`);

const lastFileContents = {};

lines.forEach((line, lineIdx) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    const toolCalls = obj.tool_calls || [];
    
    // Check tool_calls in PLANNER_RESPONSE
    toolCalls.forEach(tc => {
      if (tc.name === 'write_to_file' && tc.args && tc.args.TargetFile && tc.args.CodeContent) {
        const tf = tc.args.TargetFile;
        targetFiles.forEach(target => {
          if (tf.endsWith(target) || tf.replaceAll('\\', '/').endsWith(target)) {
            lastFileContents[target] = tc.args.CodeContent;
            console.log(`[Line ${lineIdx}] Found write_to_file for ${target} (${tc.args.CodeContent.length} bytes)`);
          }
        });
      }
    });

    // Also check view_file outputs or write_to_file results in step content
    if (obj.content && typeof obj.content === 'string') {
      targetFiles.forEach(target => {
        const fileMarker = `File Path: \`file:///${target}\``;
        const normMarker = `File Path: \`file:///e:/CV-analyzer-light - test 1/${target}\``;
        if (obj.content.includes(target)) {
          // If view_file output contains entire file without truncation
          const fullMatch = obj.content.match(/Showing lines 1 to (\d+)[\s\S]*?\n\n([\s\S]*?)(?:The above content does NOT show|$)/);
          if (fullMatch && obj.content.includes(target) && !obj.content.includes('does NOT show')) {
            const rawLines = fullMatch[2].split('\n').map(l => l.replace(/^\d+:\s?/, '')).join('\n');
            if (rawLines.length > 500) {
              lastFileContents[target + '_view'] = rawLines;
              console.log(`[Line ${lineIdx}] Found complete view_file for ${target} (${rawLines.length} bytes)`);
            }
          }
        }
      });
    }
  } catch (e) {}
});

console.log('Extracted file keys:', Object.keys(lastFileContents));

// Save extracted files to a inspection dump
fs.writeFileSync('checkpoint1_dump.json', JSON.stringify(lastFileContents, null, 2));
console.log('Saved checkpoint1_dump.json successfully.');
