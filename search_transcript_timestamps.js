import fs from 'node:fs';
import readline from 'node:readline';

const transcriptPath = 'C:\\Users\\hossa\\.gemini\\antigravity\\brain\\9028d0d0-4cb5-44f7-bf6d-d602dfd5b579\\.system_generated\\logs\\transcript.jsonl';

async function searchTranscript() {
  console.log('=== SEARCHING CONVERSATION TRANSCRIPT FOR DELETIONS (20:30:00 - 20:32:00) ===\n');

  if (!fs.existsSync(transcriptPath)) {
    console.error('Transcript file not found:', transcriptPath);
    return;
  }

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    try {
      if (line.includes('20:30:') || line.includes('20:31:') || line.includes('DELETE') || line.includes('delete')) {
        const obj = JSON.parse(line);
        // Print step index and summary of tool calls
        if (obj.tool_calls) {
          console.log(`[Step ${obj.step_index}] Tool Calls:`);
          obj.tool_calls.forEach((tc) => {
            console.log(`  - Tool: ${tc.name || tc.toolName}, Args:`, JSON.stringify(tc.args || tc.arguments || tc.parameters || {}));
          });
        }
        if (obj.content && typeof obj.content === 'string' && (obj.content.includes('jobs') || obj.content.includes('delete') || obj.content.includes('DELETE'))) {
          console.log(`[Step ${obj.step_index}] Content snippet:`, obj.content.substring(0, 300));
        }
      }
    } catch (e) {}
  }
  console.log(`\nSearched ${lineCount} transcript lines.`);
}

searchTranscript().catch(err => console.error(err));
