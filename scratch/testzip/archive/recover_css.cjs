const fs = require('fs');
const transcriptPath = 'C:\\Users\\rishi\\.gemini\\antigravity-ide\\brain\\b479f315-3637-41e5-978f-1a3342d3ba1d\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
let cssBlocks = [];

for (let line of lines) {
  try {
    const p = JSON.parse(line);
    if (p.tool_calls) {
      for (let call of p.tool_calls) {
        if (call.name === 'run_command') {
          const cmd = call.args.CommandLine;
          if (cmd && cmd.includes('@"') && cmd.includes('>> src\\index.css')) {
            const match = cmd.match(/@"([\s\S]*?)"@ >> src\\index\.css/);
            if (match) {
              cssBlocks.push(match[1]);
            }
          }
        }
      }
    }
  } catch(e) {}
}

fs.writeFileSync('recovered_all.css', cssBlocks.join('\n\n'), 'utf8');
console.log('Recovered ' + cssBlocks.length + ' blocks');
