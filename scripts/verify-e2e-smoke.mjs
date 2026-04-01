import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const apiPort = process.env.VERIFY_API_PORT ?? '3000';
const webPort = process.env.VERIFY_WEB_PORT ?? '4173';
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const children = [];

assertBuiltArtifacts();

try {
  const apiProcess = startProcess(
    'api',
    ['--filter', 'api', 'run', 'start:prod'],
    { PORT: apiPort },
  );
  const webProcess = startProcess('ops-web-preview', [
    '--filter',
    'ops-web',
    'run',
    'preview',
    '--',
    '--host',
    '127.0.0.1',
    '--port',
    webPort,
  ]);

  children.push(apiProcess, webProcess);

  await waitForUrl(`${apiBaseUrl}/api/v1/health/live`, 120_000);
  await waitForUrl(webBaseUrl, 120_000);

  await runCommand(
    ['--filter', 'ops-web', 'run', 'test:e2e:smoke'],
    {
      PLAYWRIGHT_SKIP_WEBSERVER: '1',
      PLAYWRIGHT_BASE_URL: webBaseUrl,
      PLAYWRIGHT_API_URL: `${apiBaseUrl}/api/v1`,
    },
  );
} finally {
  await Promise.all(children.map((child) => stopProcess(child)));
}

function assertBuiltArtifacts() {
  const requiredFiles = [
    path.join(rootDir, 'apps/api/dist/src/main.js'),
    path.join(rootDir, 'apps/ops-web/dist/index.html'),
  ];

  const missing = requiredFiles.filter((file) => !fs.existsSync(file));
  if (missing.length > 0) {
    throw new Error(
      `Missing built artifacts: ${missing
        .map((file) => path.relative(rootDir, file))
        .join(', ')}. Run \`pnpm run build\` before \`pnpm run verify:e2e:smoke\`.`,
    );
  }
}

function startProcess(name, args, extraEnv = {}) {
  const child = spawn(pnpmCmd, args, {
    cwd: rootDir,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
    detached: process.platform !== 'win32',
  });

  child.once('exit', (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`${name} exited early with code ${code}\n`);
    }
  });

  return child;
}

function runCommand(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, args, {
      cwd: rootDir,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: false,
    });

    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${pnpmCmd} ${args.join(' ')} failed with code ${code}`));
    });

    child.once('error', reject);
  });
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await wait(1_000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopProcess(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    await runSystemCommand('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

function runSystemCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'ignore',
      shell: false,
    });

    child.once('exit', () => resolve());
    child.once('error', () => resolve());
  });
}
