const fs = require('fs');
const html = fs.readFileSync('diaginfect_ux_audit (1).html', 'utf8');

const regex = /<div class="issue-problem">[\s\S]*?<span class="x">✕<\/span>([\s\S]*?)<\/div>\s*<div class="issue-fix">[\s\S]*?<div class="fix-label">→ Better Approach<\/div>([\s\S]*?)<\/div>/g;

let m;
let count = 0;
while ((m = regex.exec(html)) !== null) {
  let prob = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
  let fix = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
  if (!prob.includes('CRITICAL')) {
    count++;
    console.log(`Issue ${count}:`);
    console.log(`Problem: ${prob}`);
    console.log(`Fix: ${fix}\n`);
  }
}
