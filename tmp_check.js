const fs=require('fs');
const html=fs.readFileSync('frontend/pages/admin.html','utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const unique=[...new Set(ids)];
const required=['loginHint','loginBtn','retryHealthBtn','loginUser','loginPass','loginError','loginOverlay'];
console.log('HTML IDs count:', unique.length);
required.forEach(id=>console.log(id+':', unique.includes(id)));
