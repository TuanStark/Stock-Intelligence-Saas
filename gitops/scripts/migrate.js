const { spawnSync } = require('child_process');
const path = require('path');

// Locate Prisma CLI in node_modules
// This path works assuming the script is run from the root of the app or where node_modules resides
const prismaCliPath = path.resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

console.log('🚀 Starting Prisma Migration on Distroless...');

// Spawn the Node process with Prisma CLI, bypassing the need for 'npx' or shell
const result = spawnSync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error('❌ Migration failed to spawn:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`❌ Migration failed with exit code ${result.status}`);
  process.exit(result.status || 1);
}

console.log('✅ Prisma Migration completed successfully.');
