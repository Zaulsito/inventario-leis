const fs = require('fs');
const readline = require('readline');

const logPath = "C:\\Users\\Yamir\\.gemini\\antigravity\\brain\\23da867c-3365-4fa6-aaba-c7404b4080e1\\.system_generated\\logs\\transcript.jsonl";

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    try {
      const data = JSON.parse(line);
      const step = data.step_index || index;
      
      if (data.tool_calls) {
        for (const tc of data.tool_calls) {
          if (tc.name === "replace_file_content" || tc.name === "multi_replace_file_content") {
            const rc = JSON.stringify(tc.args);
            if (rc.includes("activeSlide === 1") || rc.includes("activeSlide === 2")) {
              console.log(`Step ${step} matches! Tool: ${tc.name}`);
              // Let's write the whole args object to a file for inspect
              fs.writeFileSync(`c:\\Users\\Yamir\\proyectos\\inventory-app\\scratch\\step_${step}_args.json`, JSON.stringify(tc.args, null, 2));
            }
          }
        }
      }
    } catch (e) {
    }
  }
}

run();
