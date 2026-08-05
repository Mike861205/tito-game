import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const gitCommand = isWindows ? 'git.exe' : 'git';
const commitMessageIndex = process.argv.indexOf('--message');
const commitMessage = process.argv[commitMessageIndex + 1] ?? 'deploy: update Tito Game';

function heading(message) {
  process.stdout.write(`\n== ${message} ==\n`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`> ${command} ${args.join(' ')}\n`);
    const usesCmdShim = isWindows && command.toLowerCase().endsWith('.cmd');
    const executable = usesCmdShim ? (process.env.ComSpec ?? 'cmd.exe') : command;
    const executableArgs = usesCmdShim ? ['/d', '/s', '/c', command, ...args] : args;
    const child = spawn(executable, executableArgs, {
      cwd: process.cwd(),
      windowsHide: true,
      env: process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    }
    child.on('error', reject);
    child.on('close', (code) => {
      const allowed = options.allowedCodes ?? [0];
      if (allowed.includes(code ?? 1)) {
        resolve({ code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        if (stderr) process.stderr.write(stderr);
        reject(new Error(`${command} termino con codigo ${code ?? 1}`));
      }
    });
  });
}

async function main() {
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
    process.stdout.write('No hay cambios locales pendientes; se desplegara el commit actual.\n');
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
  process.stdout.write(`Commit en produccion: ${commit.stdout}\n`);
  process.stdout.write('Sitio: https://tito.systemdem.online\n');
}

main().catch((error) => {
  process.stderr.write(`\nERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
