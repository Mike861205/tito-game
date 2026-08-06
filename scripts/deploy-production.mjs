import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const gitCommand = isWindows ? 'git.exe' : 'git';
const commitMessageIndex = process.argv.indexOf('--message');
const commitMessage = process.argv[commitMessageIndex + 1] ?? 'deploy: update Tito Game';
const stateFileIndex = process.argv.indexOf('--state-file');
const stateFile = stateFileIndex >= 0 ? process.argv[stateFileIndex + 1] : undefined;
const jobIdIndex = process.argv.indexOf('--job-id');
const jobId = jobIdIndex >= 0 ? process.argv[jobIdIndex + 1] : undefined;
let deployState;

function loadState() {
  if (!stateFile || !existsSync(stateFile)) return undefined;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return !jobId || state.id === jobId ? state : undefined;
  } catch {
    return undefined;
  }
}

function saveState() {
  if (!stateFile || !deployState) return;
  writeFileSync(stateFile, JSON.stringify(deployState, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function cleanLog(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '').replace(/\r/g, '');
}

function record(value) {
  if (!deployState) return;
  const lines = cleanLog(value).split('\n').filter(Boolean);
  deployState.logs.push(...lines);
  if (deployState.logs.length > 500) deployState.logs.splice(0, deployState.logs.length - 500);
  saveState();
}

function output(value, error = false) {
  (error ? process.stderr : process.stdout).write(value);
  record(value);
}

function heading(message) {
  output(`\n== ${message} ==\n`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    output(`> ${command} ${args.join(' ')}\n`);
    const usesCmdShim = isWindows && command.toLowerCase().endsWith('.cmd');
    const executable = usesCmdShim ? (process.env.ComSpec ?? 'cmd.exe') : command;
    const executableArgs = usesCmdShim ? ['/d', '/s', '/c', command, ...args] : args;
    const child = spawn(executable, executableArgs, {
      cwd: process.cwd(),
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!options.capture) output(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!options.capture) output(text, true);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const allowed = options.allowedCodes ?? [0];
      if (allowed.includes(code ?? 1)) {
        resolve({ code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        if (stderr && options.capture) output(stderr, true);
        reject(new Error(`${command} termino con codigo ${code ?? 1}`));
      }
    });
  });
}

async function main() {
  deployState = loadState();
  if (deployState) {
    deployState.status = 'running';
    deployState.logs ??= [];
    saveState();
  }
  heading('Comprobando rama y cambios');
  const branch = await run(gitCommand, ['branch', '--show-current'], { capture: true });
  if (branch.stdout !== 'main') throw new Error(`El despliegue solo acepta la rama main; rama actual: ${branch.stdout}`);

  heading('Validacion local');
  await run(npmCommand, ['run', 'build:shared']);
  await run(npmCommand, ['run', 'typecheck']);
  await run(npmCommand, ['run', 'build', '--workspace', '@tito/game']);
  await run(npmCommand, ['audit', '--omit=dev', '--audit-level=high']);

  const status = await run(gitCommand, ['status', '--porcelain'], { capture: true });
  if (status.stdout) {
    heading('Creando commit');
    await run(gitCommand, ['add', '--all']);
    await run(gitCommand, ['commit', '-m', commitMessage]);
  } else {
    output('No hay cambios locales pendientes; se desplegara el commit actual.\n');
  }

  heading('Push a GitHub');
  await run(gitCommand, ['push', 'origin', 'main']);

  heading('Despliegue en Liquid Web');
  const remote = [
    'set -e',
    'sudo -u tito -H git -C /var/www/tito pull --ff-only origin main',
    'cd /var/www/tito',
    'sudo -u tito -H npm ci',
    'sudo -u tito -H npm run build',
    'sudo -u tito -H npm run db:deploy --workspace @tito/api',
    'cd /home/tito',
    'sudo -u tito -H pm2 startOrReload /var/www/tito/deploy/ecosystem.config.cjs --update-env',
    'sudo -u tito -H pm2 save',
    'sleep 3',
    'curl --fail --silent --show-error https://tito.systemdem.online/api/health',
  ].join('; ');
  await run('ssh', ['-o', 'BatchMode=yes', 'root@50.28.103.1', remote]);

  heading('Despliegue completado');
  const commit = await run(gitCommand, ['rev-parse', '--short', 'HEAD'], { capture: true });
  output(`Commit en produccion: ${commit.stdout}\n`);
  output('Sitio: https://tito.systemdem.online\n');
  if (deployState) {
    deployState.status = 'success';
    deployState.exitCode = 0;
    deployState.finishedAt = new Date().toISOString();
    deployState.logs.push('Despliegue terminado correctamente.');
    saveState();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  output(`\nERROR: ${message}\n`, true);
  if (deployState) {
    deployState.status = 'failed';
    deployState.exitCode = 1;
    deployState.finishedAt = new Date().toISOString();
    deployState.logs.push('El despliegue se detuvo. Revisa el error anterior.');
    saveState();
  }
  process.exitCode = 1;
});
