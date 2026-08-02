const bcrypt = require('bcrypt');

// Generate hash
const hash = bcrypt.hashSync('pulseras2026', 10);
console.log('Generated hash:', hash);
console.log('Hash length:', hash.length);

// Verify
console.log('Compare result:', bcrypt.compareSync('pulseras2026', hash));
console.log('Compare wrong:', bcrypt.compareSync('wrong', hash));

// Now test with the hash stored on the old Render service
const storedHash = '$2b$10$mm4DdMhN0bRQpqNJ8EA0o.RVpGMuSlrTHC9rCdqQ3j298ROl9cKVK';
console.log('\nStored hash:', storedHash);
console.log('Stored hash length:', storedHash.length);
console.log('Compare with stored hash:', bcrypt.compareSync('pulseras2026', storedHash));
