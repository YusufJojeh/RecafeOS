const path = require('node:path');

process.on('unhandledRejection', (error) => {
  console.error('verify-route-permissions runner caught unhandledRejection');
  console.error(error);
});

process.on('uncaughtException', (error) => {
  console.error('verify-route-permissions runner caught uncaughtException');
  console.error(error);
});

process.env.JWT_ACCESS_SECRET ??= 'dev-access-secret-dev-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'dev-refresh-secret-dev-refresh-secret';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';

process.env.TS_NODE_PROJECT = path.resolve(__dirname, '../tsconfig.scripts.json');
require('ts-node/register/transpile-only');
require('./verify-route-permissions.ts');
