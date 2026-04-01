import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    shell: false,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    status: result.status ?? 1,
  };
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function checkEnvFiles() {
  const rootEnv = path.join(repoRoot, '.env');
  const apiEnv = path.join(repoRoot, 'apps', 'api', '.env');
  if (fs.existsSync(rootEnv) || fs.existsSync(apiEnv)) {
    return {
      ok: true,
      summary: 'Environment file found.',
      detail: fs.existsSync(rootEnv)
        ? '.env present.'
        : 'apps/api/.env present.',
      severity: 'pass',
    };
  }

  return {
    ok: false,
    summary: 'No local environment file found.',
    detail: 'Copy .env.example to .env before local setup.',
    severity: 'fail',
  };
}

function checkDocker() {
  const result = runCommand('docker', ['ps']);
  if (result.ok) {
    return {
      ok: true,
      summary: 'Docker daemon reachable.',
      detail: 'Local infra can be provisioned with docker compose.',
      severity: 'pass',
    };
  }

  return {
    ok: false,
    summary: 'Docker daemon is unavailable.',
    detail:
      result.stderr ||
      result.stdout ||
      'Start Docker Desktop or use an already-running Postgres/Redis pair.',
    severity: 'warn',
  };
}

function checkNodeScript(script) {
  return runCommand(process.execPath, [script]);
}

function checkNodeScriptInCwd(script, cwd) {
  return runCommand(process.execPath, [script], { cwd });
}

function checkNpmScript(scriptArgs) {
  return runCommand(npmCommand(), scriptArgs);
}

function mapScriptResult(result, successSummary, failureSummary, severity = 'fail') {
  return {
    ok: result.ok,
    summary: result.ok ? successSummary : failureSummary,
    detail: result.ok ? result.stdout || 'OK' : result.stderr || result.stdout || 'Failed.',
    severity: result.ok ? 'pass' : severity,
  };
}

const checks = [
  ['env', checkEnvFiles()],
  ['docker', checkDocker()],
  [
    'db-provider',
    mapScriptResult(
      checkNodeScript('scripts/db-provider-report.mjs'),
      'Database provider environment resolved.',
      'Database provider environment is invalid.',
    ),
  ],
  [
    'db-connect',
    mapScriptResult(
      checkNodeScript('scripts/check-database-connection.mjs'),
      'Database connectivity check passed.',
      'Database connectivity check failed.',
    ),
  ],
  [
    'redis-connect',
    mapScriptResult(
      checkNodeScript('scripts/check-redis-connection.mjs'),
      'Redis connectivity check passed.',
      'Redis connectivity check failed.',
    ),
  ],
  [
    'verify-permissions',
    mapScriptResult(
      checkNodeScriptInCwd(
        'scripts/verify-route-permissions.runner.cjs',
        path.join(repoRoot, 'apps', 'api'),
      ),
      'Route permission verification passed.',
      'Route permission verification failed.',
    ),
  ],
];

const blockingFailures = checks.filter(
  ([key, result]) => key !== 'docker' && !result.ok,
);
const warnings = checks.filter(([, result]) => result.severity === 'warn' && !result.ok);

process.stdout.write('RestoCafe OS local doctor\n');
process.stdout.write('=========================\n');

for (const [key, result] of checks) {
  const badge =
    result.severity === 'warn' && !result.ok
      ? 'WARN'
      : result.ok
        ? 'PASS'
        : 'FAIL';
  process.stdout.write(`\n[${badge}] ${key}\n`);
  process.stdout.write(`${result.summary}\n`);
  if (result.detail) {
    process.stdout.write(`${result.detail}\n`);
  }
}

process.stdout.write('\nSummary\n');
process.stdout.write('-------\n');

if (blockingFailures.length === 0) {
  process.stdout.write('Local verification prerequisites are ready.\n');
  if (warnings.length > 0) {
    process.stdout.write(
      'Warnings remain, but they are not blocking while DB/Redis are already reachable.\n',
    );
  }
  process.exit(0);
}

process.stdout.write(
  `Blocking failures: ${blockingFailures.map(([key]) => key).join(', ')}.\n`,
);
process.stdout.write(
  'Fix these before running migrations, integration tests, or e2e smoke locally.\n',
);
process.exit(1);
