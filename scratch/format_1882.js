const fs = require('fs');
const path = require('path');

const inputPath = path.join("c:", "Users", "Yamir", "proyectos", "inventory-app", "scratch", "step_1882_args.json");
const outputPath = path.join("c:", "Users", "Yamir", "proyectos", "inventory-app", "scratch", "step_1882_formatted.txt");

const raw = fs.readFileSync(inputPath, "utf8");
const data = JSON.parse(raw);
const rc = data.ReplacementContent;

// Unescape
const formatted = rc.replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');

fs.writeFileSync(outputPath, formatted);
console.log("Formatted step 1882!");
