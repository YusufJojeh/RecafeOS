import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { loadProviderEnv } from './provider-env.mjs';

loadProviderEnv('mysql');

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  process.stderr.write(
    'DATABASE_URL is not set. Copy `.env.mysql-xampp.example` to `.env.mysql-xampp` first.\n',
  );
  process.exit(1);
}

let url;
try {
  url = new URL(databaseUrl);
} catch {
  process.stderr.write('DATABASE_URL is not a valid URL.\n');
  process.exit(1);
}

if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
  process.stderr.write(
    'ensure-mysql-database only supports mysql:// or mariadb:// URLs.\n',
  );
  process.exit(1);
}

const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!databaseName) {
  process.stderr.write(
    'DATABASE_URL must include a database name, e.g. mysql://root:@127.0.0.1:3306/restocafe.\n',
  );
  process.exit(1);
}

const mysqlBinary = resolveMysqlBinary();
if (!mysqlBinary) {
  process.stderr.write(
    'Could not find a MySQL client binary. For XAMPP on Windows, ensure `C:\\xampp\\mysql\\bin\\mysql.exe` exists or set `MYSQL_CLIENT_BIN`.\n',
  );
  process.exit(1);
}

const args = [
  '--protocol=tcp',
  '--host',
  url.hostname || '127.0.0.1',
  '--port',
  url.port || '3306',
  '--user',
  decodeURIComponent(url.username || 'root'),
];

const password = decodeURIComponent(url.password || '');
if (password) {
  args.push(`--password=${password}`);
}

args.push(
  '-e',
  `CREATE DATABASE IF NOT EXISTS \`${databaseName.replace(/`/g, '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
);

const result = spawnSync(mysqlBinary, args, {
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

process.stdout.write(`Ensured MySQL database \`${databaseName}\` exists.\n`);

function resolveMysqlBinary() {
  const candidates = [
    process.env.MYSQL_CLIENT_BIN,
    'C:\\xampp\\mysql\\bin\\mysql.exe',
    'mysql',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'mysql') {
      return candidate;
    }
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
