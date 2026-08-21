const sql = "INSERT INTO orders (tenant_id) VALUES (COALESCE(current_setting('app.current_tenant', TRUE), 'default'))";
const replaced = sql.replace(/current_setting\('app\.current_tenant',\s*TRUE\)/gi, "'default'");
console.log('Original:', sql);
console.log('Replaced:', replaced);
