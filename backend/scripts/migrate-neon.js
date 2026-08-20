'use strict';

const { runMigrations } = require('./run-migrations');

async function main() {
  await runMigrations('up');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
