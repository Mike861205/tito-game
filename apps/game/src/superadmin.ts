const API_URL = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'tito.superadmin.token';

interface DeployJob {
  id: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  logs: string[];
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { message: string };
}

let token = sessionStorage.getItem(TOKEN_KEY);
let pollTimer: number | undefined;

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    if (response.status === 401) logout();
    throw new ApiError(payload.error?.message ?? 'No se pudo completar la operacion', response.status);
  }
  return payload.data;
}

export function renderSuperadmin(): void {
  document.title = 'Superadmin local | Tito Game';
  document.body.classList.add('superadmin-page');
  document.getElementById('boot-screen')?.remove();
  document.getElementById('rotate-hint')?.remove();
  document.getElementById('fullscreen-button')?.remove();
  document.getElementById('mobile-controls')?.remove();

  const root = document.getElementById('game-root');
  if (!root) return;
  root.innerHTML = `
    <style>
      body.superadmin-page { overflow: auto; touch-action: auto; background: #050817; color: #e9f2ff; }
      body.superadmin-page #game-root { position:static; width:100%; height:auto; min-height:100dvh; display:block; padding:0; overflow:visible; }
      .admin-shell { width: min(1050px, calc(100% - 28px)); margin: 28px auto; font-family: Inter, "Segoe UI", sans-serif; }
      .admin-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; }
      .admin-brand { display:flex; align-items:center; gap:12px; font-weight:900; letter-spacing:.7px; }
      .admin-brand img { width:54px; height:54px; object-fit:contain; filter:drop-shadow(0 5px 14px #000); }
      .admin-pill { padding:7px 12px; border:1px solid #2d466f; border-radius:999px; color:#8fd8ff; font-size:12px; background:#0d1730; }
      .admin-card { background:linear-gradient(150deg,rgba(17,28,55,.98),rgba(7,12,27,.98)); border:1px solid #29446e; border-radius:22px; padding:clamp(20px,4vw,38px); box-shadow:0 24px 70px rgba(0,0,0,.38); }
      .admin-card h1 { margin:0 0 8px; font-size:clamp(28px,5vw,46px); }
      .admin-card h2 { margin:0 0 8px; font-size:clamp(22px,3vw,30px); }
      .admin-muted { color:#9cacca; line-height:1.55; }
      .admin-form { display:grid; gap:15px; max-width:460px; margin-top:26px; }
      .admin-label { display:grid; gap:7px; font-size:13px; color:#b8c8e4; font-weight:700; }
      .admin-input { width:100%; min-height:48px; border:1px solid #35517c; border-radius:12px; padding:0 14px; color:#fff; background:#080f21; font:600 15px/1 "Segoe UI"; outline:none; }
      .admin-input:focus { border-color:#55b7ff; box-shadow:0 0 0 3px rgba(66,160,255,.18); }
      .admin-button { min-height:50px; border:0; border-radius:13px; padding:0 20px; cursor:pointer; color:#fff; background:#2368db; font:900 14px/1 "Segoe UI"; letter-spacing:.4px; box-shadow:0 8px 20px rgba(15,78,190,.25); }
      .admin-button:hover { background:#3280f2; }
      .admin-button:disabled { cursor:not-allowed; opacity:.55; }
      .admin-button.danger { background:linear-gradient(135deg,#df5539,#b82842); min-width:230px; }
      .admin-button.ghost { min-height:38px; color:#b9cae6; border:1px solid #304a73; background:#101a31; box-shadow:none; }
      .admin-alert { display:none; margin-top:14px; padding:12px 14px; border-radius:11px; background:#4a1f2a; border:1px solid #a74659; color:#ffd5dc; }
      .admin-alert.visible { display:block; }
      .admin-grid { display:grid; grid-template-columns:1fr .95fr; gap:20px; margin-top:20px; }
      .admin-panel { min-width:0; border:1px solid #263f67; border-radius:17px; padding:21px; background:rgba(5,11,25,.72); }
      .admin-list { margin:18px 0 0; padding:0; list-style:none; display:grid; gap:11px; color:#c3d0e7; }
      .admin-list li::before { content:"✓"; color:#60e0a1; font-weight:900; margin-right:9px; }
      .admin-log { min-height:280px; max-height:430px; overflow:auto; margin-top:14px; padding:15px; border-radius:12px; background:#030711; border:1px solid #1c3152; color:#aee0ff; white-space:pre-wrap; word-break:break-word; font:12px/1.55 Consolas,monospace; }
      .admin-status { display:inline-flex; align-items:center; gap:8px; padding:7px 11px; border-radius:999px; background:#15223d; color:#9fb2d2; font-size:12px; font-weight:800; }
      .admin-status.running { color:#ffe28c; } .admin-status.success { color:#74ecad; } .admin-status.failed { color:#ff8c9d; }
      .admin-dot { width:8px; height:8px; border-radius:50%; background:currentColor; box-shadow:0 0 9px currentColor; }
      .admin-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:18px; }
      .admin-modal-backdrop { position:fixed; inset:0; z-index:100; display:grid; place-items:center; padding:20px; background:rgba(1,4,12,.78); backdrop-filter:blur(9px); opacity:1; transition:opacity .18s ease; }
      .admin-modal-backdrop[hidden] { display:none; }
      .admin-modal { width:min(560px,100%); border:1px solid #3f68a4; border-radius:22px; padding:26px; background:linear-gradient(155deg,#142446,#080e1e 72%); box-shadow:0 30px 100px rgba(0,0,0,.65),0 0 42px rgba(54,137,255,.12); }
      .admin-modal-icon { width:54px; height:54px; display:grid; place-items:center; border-radius:16px; color:#07101f; background:linear-gradient(145deg,#ffe27a,#ffad35); font-size:27px; font-weight:900; box-shadow:0 10px 30px rgba(255,181,54,.2); }
      .admin-modal h3 { margin:18px 0 7px; font-size:25px; }
      .admin-modal-summary { margin:18px 0; padding:15px; border:1px solid #2d4c78; border-radius:13px; background:#071022; }
      .admin-modal-summary small { display:block; margin-bottom:7px; color:#7f96bb; font-weight:800; letter-spacing:.6px; }
      .admin-modal-summary strong { display:block; color:#fff; overflow-wrap:anywhere; }
      .admin-modal-note { display:flex; gap:10px; margin:0; padding:12px 14px; border-radius:12px; color:#bcd5f6; background:rgba(32,104,211,.13); line-height:1.45; font-size:13px; }
      .admin-modal-actions { display:flex; justify-content:flex-end; gap:11px; margin-top:22px; }
      .admin-button.confirm { background:linear-gradient(135deg,#eb6044,#c52e49); min-width:190px; }
      .admin-status.reconnecting { color:#8fd8ff; }
      .admin-status.running .admin-dot,.admin-status.reconnecting .admin-dot { animation:adminPulse 1s ease-in-out infinite; }
      @keyframes adminPulse { 50% { opacity:.25; transform:scale(.65); } }
      #admin-dashboard[hidden], #admin-login[hidden] { display:none; }
      @media (max-width:760px) { .admin-shell{margin:14px auto}.admin-grid{grid-template-columns:1fr}.admin-card{padding:20px}.admin-nav{align-items:flex-start}.admin-pill{max-width:52%;text-align:right}.admin-modal{padding:21px}.admin-modal-actions{flex-direction:column-reverse}.admin-modal-actions .admin-button{width:100%} }
    </style>
    <main class="admin-shell">
      <nav class="admin-nav">
        <div class="admin-brand"><img src="/assets/branding/logo.png" alt="Tito Game"><span>SUPERADMIN</span></div>
        <span class="admin-pill">LOCALHOST · DESARROLLO → PRODUCCION</span>
      </nav>
      <section id="admin-login" class="admin-card">
        <h1>Centro de despliegue</h1>
        <p class="admin-muted">Acceso privado local para publicar Tito Game en GitHub y Liquid Web.</p>
        <form id="login-form" class="admin-form">
          <label class="admin-label">Usuario<input id="admin-user" class="admin-input" autocomplete="username" value="mike" required></label>
          <label class="admin-label">Contraseña<input id="admin-password" class="admin-input" type="password" autocomplete="current-password" required></label>
          <button class="admin-button" type="submit">ENTRAR AL SUPERADMIN</button>
        </form>
        <div id="login-error" class="admin-alert" role="alert"></div>
      </section>
      <section id="admin-dashboard" class="admin-card" hidden>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
          <div><h2>Publicar nueva version</h2><p class="admin-muted">Valida el proyecto, crea el commit, hace push a <b>main</b> y actualiza Liquid Web.</p></div>
          <button id="logout-button" class="admin-button ghost" type="button">SALIR</button>
        </div>
        <div class="admin-grid">
          <div class="admin-panel">
            <label class="admin-label">Mensaje del commit
              <input id="commit-message" class="admin-input" maxlength="120" value="deploy: mejoras de Tito Game" required>
            </label>
            <ul class="admin-list">
              <li>Typecheck y build del juego</li><li>Auditoria de dependencias</li><li>Commit y push a GitHub</li><li>Build, migraciones y PM2</li><li>Comprobacion HTTPS y Neon</li>
            </ul>
            <div class="admin-actions"><button id="deploy-button" class="admin-button danger" type="button">PUSH + DEPLOY</button></div>
            <div id="deploy-error" class="admin-alert" role="alert"></div>
          </div>
          <div class="admin-panel">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><strong>Estado del despliegue</strong><span id="deploy-status" class="admin-status"><i class="admin-dot"></i>LISTO</span></div>
            <pre id="deploy-log" class="admin-log">Todavia no se ha iniciado un despliegue en esta sesion.</pre>
          </div>
        </div>
      </section>
    </main>
    <div id="deploy-modal" class="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="deploy-modal-title" hidden>
      <section class="admin-modal">
        <div class="admin-modal-icon">↑</div>
        <h3 id="deploy-modal-title">Confirmar publicación</h3>
        <p class="admin-muted">Se ejecutará el flujo completo de desarrollo a producción.</p>
        <div class="admin-modal-summary"><small>MENSAJE DEL COMMIT</small><strong id="modal-commit-message"></strong></div>
        <p class="admin-modal-note"><span>●</span><span>El panel puede reconectarse durante la compilación. No cierres esta pestaña; el despliegue continuará aunque la API local se reinicie.</span></p>
        <div class="admin-modal-actions">
          <button id="modal-cancel" class="admin-button ghost" type="button">CANCELAR</button>
          <button id="modal-confirm" class="admin-button confirm" type="button">CONFIRMAR PUSH + DEPLOY</button>
        </div>
      </section>
    </div>`;

  document.getElementById('login-form')?.addEventListener('submit', (event) => void login(event));
  document.getElementById('deploy-button')?.addEventListener('click', openDeployModal);
  document.getElementById('logout-button')?.addEventListener('click', logout);
  document.getElementById('modal-cancel')?.addEventListener('click', closeDeployModal);
  document.getElementById('modal-confirm')?.addEventListener('click', () => void confirmDeploy());
  document.getElementById('deploy-modal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeDeployModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDeployModal();
  });
  if (token) {
    showDashboard();
    void restoreSession();
  }
}

async function login(event: Event): Promise<void> {
  event.preventDefault();
  const button = document.querySelector<HTMLButtonElement>('#login-form button');
  const error = document.getElementById('login-error');
  button?.setAttribute('disabled', 'true');
  error?.classList.remove('visible');
  try {
    const user = (document.getElementById('admin-user') as HTMLInputElement).value;
    const password = (document.getElementById('admin-password') as HTMLInputElement).value;
    const data = await request<{ token: string; job?: DeployJob }>('/api/superadmin/login', {
      method: 'POST',
      body: JSON.stringify({ user, password }),
    });
    token = data.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    showDashboard();
    if (data.job) renderJob(data.job);
  } catch (cause) {
    if (error) {
      error.textContent = cause instanceof Error ? cause.message : 'No se pudo iniciar sesion';
      error.classList.add('visible');
    }
  } finally {
    button?.removeAttribute('disabled');
  }
}

async function restoreSession(): Promise<void> {
  try {
    const data = await request<{ job: DeployJob | null }>('/api/superadmin/deploy');
    document.getElementById('deploy-error')?.classList.remove('visible');
    if (data.job) renderJob(data.job);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return;
    showReconnecting('Esperando que la API local vuelva a estar disponible...');
  }
}

function showDashboard(): void {
  document.getElementById('admin-login')?.setAttribute('hidden', '');
  document.getElementById('admin-dashboard')?.removeAttribute('hidden');
}

function openDeployModal(): void {
  const message = (document.getElementById('commit-message') as HTMLInputElement).value.trim();
  const error = document.getElementById('deploy-error');
  error?.classList.remove('visible');
  if (message.length < 3) {
    if (error) {
      error.textContent = 'Escribe un mensaje de commit de al menos 3 caracteres.';
      error.classList.add('visible');
    }
    return;
  }
  const preview = document.getElementById('modal-commit-message');
  if (preview) preview.textContent = message;
  document.getElementById('deploy-modal')?.removeAttribute('hidden');
  (document.getElementById('modal-confirm') as HTMLButtonElement | null)?.focus();
}

function closeDeployModal(): void {
  document.getElementById('deploy-modal')?.setAttribute('hidden', '');
}

async function confirmDeploy(): Promise<void> {
  const message = (document.getElementById('commit-message') as HTMLInputElement).value.trim();
  const error = document.getElementById('deploy-error');
  const confirm = document.getElementById('modal-confirm') as HTMLButtonElement | null;
  confirm?.setAttribute('disabled', 'true');
  try {
    const data = await request<{ job: DeployJob }>('/api/superadmin/deploy', {
      method: 'POST',
      body: JSON.stringify({ commitMessage: message }),
    });
    closeDeployModal();
    renderJob(data.job);
  } catch (cause) {
    closeDeployModal();
    if (error) {
      error.textContent = cause instanceof Error ? cause.message : 'No se pudo iniciar el despliegue';
      error.classList.add('visible');
    }
  } finally {
    confirm?.removeAttribute('disabled');
  }
}

function renderJob(job: DeployJob): void {
  const status = document.getElementById('deploy-status');
  const log = document.getElementById('deploy-log');
  const button = document.getElementById('deploy-button') as HTMLButtonElement | null;
  const labels = { running: 'DESPLEGANDO', success: 'PUBLICADO', failed: 'FALLO' } as const;
  if (status) {
    status.className = `admin-status ${job.status}`;
    status.innerHTML = '<i class="admin-dot"></i>';
    status.append(labels[job.status]);
  }
  if (log) {
    log.textContent = job.logs.join('\n');
    log.scrollTop = log.scrollHeight;
  }
  if (button) button.disabled = job.status === 'running';
  window.clearTimeout(pollTimer);
  if (job.status === 'running') pollTimer = window.setTimeout(() => void pollJob(), 1200);
}

async function pollJob(): Promise<void> {
  try {
    const data = await request<{ job: DeployJob | null }>('/api/superadmin/deploy');
    document.getElementById('deploy-error')?.classList.remove('visible');
    if (data.job) renderJob(data.job);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return;
    showReconnecting('La API local se reinició durante el build. Reconectando sin cerrar tu sesión...');
  }
}

function showReconnecting(message: string): void {
  const status = document.getElementById('deploy-status');
  if (status) {
    status.className = 'admin-status reconnecting';
    status.innerHTML = '<i class="admin-dot"></i>RECONECTANDO';
  }
  const error = document.getElementById('deploy-error');
  if (error) {
    error.textContent = message;
    error.classList.add('visible');
  }
  window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(() => void restoreSession(), 1600);
}

function logout(): void {
  token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  window.clearTimeout(pollTimer);
  document.getElementById('admin-dashboard')?.setAttribute('hidden', '');
  document.getElementById('admin-login')?.removeAttribute('hidden');
}
