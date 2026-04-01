import { spawn } from 'node:child_process';
import process from 'node:process';
import { loadProviderEnv } from './provider-env.mjs';

const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');
const provider = args[0];
const commandArgs =
  separatorIndex >= 0 ? args.slice(separatorIndex + 1) : args.slice(1);

if (provider !== 'postgresql' && provider !== 'mysql') {
  process.stderr.write(
    'Usage: node scripts/run-with-provider.mjs <postgresql|mysql> -- <command...>\n',
  );
  process.exit(1);
}

if (commandArgs.length === 0) {
  process.stderr.write('No command was provided.\n');
  process.exit(1);
}

process.env.DB_PROVIDER = provider;
process.env.ALLOW_MYSQL_LOCAL = provider === 'mysql' ? 'true' : 'false';
loadProviderEnv(provider);

const command = commandArgs.join(' ');
const child = spawn(command, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
