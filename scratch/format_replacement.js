const fs = require('fs');
const path = require('path');

const inputPath = path.join("c:", "Users", "Yamir", "proyectos", "inventory-app", "scratch", "step_1771_replacement.txt");
const outputPath = path.join("c:", "Users", "Yamir", "proyectos", "inventory-app", "scratch", "step_1771_formatted.txt");

const content = fs.readFileSync(inputPath, "utf8");
console.log("Input size:", content.length);

// The content in step_1771_replacement.txt is a raw string representing code.
// Let's replace escaped newlines \\n with real newlines \n, etc.
let formatted = content.replace(/\\n/g, '\n')
                         .replace(/\\t/g, '\t')
                         .replace(/\\"/g, '"')
                         .replace(/\\\\/g, '\\');

fs.writeFileSync(outputPath, formatted);
console.log("Output size:", formatted.length);
