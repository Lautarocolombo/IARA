const fs = require('fs');
const html = fs.readFileSync('frontend/pages/dashboard.html', 'utf8');

// Check contentEditorRoot structure
const contentStart = html.indexOf('<div id="contentEditorRoot">');
const contentEnd = html.indexOf('</section>', contentStart);
const section = html.substring(contentStart, contentEnd);

const opens = (section.match(/<div/g) || []).length;
const closes = (section.match(/<\/div>/g) || []).length;
console.log('Opening <div count:', opens);
console.log('Closing </div> count:', closes);
console.log('Difference:', opens - closes);

// Check tab panels
const panels = (section.match(/<div class="content-tab-panel/g) || []).length;
console.log('Tab panels:', panels);

// Check cards inside panels
const cards = (section.match(/<div class="card">/g) || []).length;
console.log('Cards:', cards);

// Check tab buttons
const tabs = (section.match(/<button class="content-tab/g) || []).length;
console.log('Tab buttons:', tabs);

if (opens - closes === 0 && panels === 7 && cards === 7 && tabs === 7) {
  console.log('\n✅ Structure looks correct!');
} else {
  console.log('\n❌ Structure may have issues');
}
