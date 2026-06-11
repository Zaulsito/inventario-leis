const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\Yamir\\proyectos\\inventory-app\\scratch\\step_1882_formatted.txt", "utf8");

// Strip first and last quote if present
let cleaned = content.trim();
if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
  cleaned = cleaned.slice(1, -1);
}

// Convert all escaped newlines \n to real newlines
const realLines = cleaned.replace(/\\n/g, '\n')
                          .replace(/\\t/g, '\t')
                          .replace(/\\"/g, '"')
                          .replace(/\\\\/g, '\\');

fs.writeFileSync("c:\\Users\\Yamir\\proyectos\\inventory-app\\scratch\\step_1882_real_lines.txt", realLines);
console.log("Written multi-line content! Size:", realLines.length);
