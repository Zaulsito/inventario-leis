const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\Yamir\\proyectos\\inventory-app\\scratch\\step_1771_full.txt", "utf8");

let formatted = content;
try {
  // Try parsing as JSON since it's a quoted JSON string literal
  formatted = JSON.parse(content);
} catch (e) {
  // If parsing fails, do manual unescape
  formatted = content.replace(/\\n/g, '\n')
                     .replace(/\\t/g, '\t')
                     .replace(/\\"/g, '"')
                     .replace(/\\\\/g, '\\');
}

fs.writeFileSync("c:\\Users\\Yamir\\proyectos\\inventory-app\\scratch\\step_1771_formatted_correctly.txt", formatted);
console.log("Written formatted multiline text of Step 1771!");
