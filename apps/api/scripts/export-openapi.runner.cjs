const path = require('node:path');

process.on('unhandledRejection', (error) => {
  console.error(error);
  process.exit(1);
});

process.env.NODE_ENV ??= 'test';
process.env.JWT_ACCESS_SECRET ??= 'dev-access-secret-dev-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'dev-refresh-secret-dev-refresh-secret';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.DATABASE_URL ??=
  'postgresql://user:pass@localhost:5432/restocafe_openapi_export?schema=public';

process.env.TS_NODE_PROJECT = path.resolve(__dirname, '../tsconfig.scripts.json');
require('ts-node/register/transpile-only');
require('./export-openapi.ts');
