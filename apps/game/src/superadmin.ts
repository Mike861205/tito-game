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

interface PlayerReport {
  id: string; name: string; username: string; phone: string | null; avatar: string;
  registeredAt: string; lastLoginAt: string | null; lastActivityAt: string | null;
  logins: number; games: number; completedGames: number; minutesPlayed: number; score: number; coins: number;
}

interface PlayerReportData {
  summary: { totalPlayers: number; newPlayers: number; totalLogins: number; totalGames: number; totalMinutes: number };
  players: PlayerReport[];
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
      body.superadmin-page { overflow:auto; touch-action:auto; background:#030611; color:#e9f2ff; }
      body.superadmin-page::before { content:""; position:fixed; inset:0; pointer-events:none; background:radial-gradient(circle at 12% 15%,rgba(29,103,222,.18),transparent 28%),radial-gradient(circle at 88% 72%,rgba(86,41,180,.14),transparent 30%),linear-gradient(rgba(83,133,204,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(83,133,204,.035) 1px,transparent 1px); background-size:auto,auto,42px 42px,42px 42px; }
      body.superadmin-page #game-root { position:static; width:100%; height:auto; min-height:100dvh; display:block; padding:0; overflow:visible; }
      .admin-shell { position:relative; z-index:1; width:min(1240px,calc(100% - 32px)); margin:0 auto; padding:22px 0 38px; font-family:Inter,"Segoe UI",sans-serif; }
      .admin-nav { display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:66px; margin-bottom:22px; }
      .admin-brand { display:flex; align-items:center; gap:12px; font-weight:950; letter-spacing:.8px; }
      .admin-brand img { width:52px; height:52px; object-fit:contain; filter:drop-shadow(0 6px 15px #000); }
      .admin-brand-copy { display:grid; gap:2px; }
      .admin-brand-copy small { color:#6f86aa; font-size:9px; letter-spacing:2px; }
      .admin-pill { display:inline-flex; align-items:center; gap:8px; padding:8px 13px; border:1px solid #294d7a; border-radius:999px; color:#8fd8ff; font-size:11px; font-weight:800; background:rgba(11,25,50,.82); }
      .admin-pill::before { content:""; width:7px; height:7px; border-radius:50%; background:#55e29a; box-shadow:0 0 10px #55e29a; }
      .admin-card { overflow:hidden; background:linear-gradient(150deg,rgba(17,29,57,.98),rgba(6,11,25,.99)); border:1px solid #28466f; border-radius:26px; box-shadow:0 28px 90px rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.025); }
      .admin-card h1,.admin-card h2,.admin-card h3 { text-wrap:balance; }
      .admin-muted { margin:0; color:#94a8c8; line-height:1.6; }
      .login-card { display:grid; grid-template-columns:minmax(0,1.08fr) minmax(380px,.92fr); min-height:min(650px,calc(100dvh - 122px)); }
      .login-visual { position:relative; display:flex; flex-direction:column; justify-content:space-between; min-width:0; padding:clamp(34px,5vw,68px); isolation:isolate; background:radial-gradient(circle at 18% 20%,rgba(63,145,255,.26),transparent 31%),linear-gradient(145deg,rgba(19,56,111,.88),rgba(9,16,36,.94)); }
      .login-visual::before { content:""; position:absolute; inset:0; z-index:-1; opacity:.32; background:linear-gradient(120deg,transparent 0 45%,rgba(109,180,255,.14) 45.2% 45.5%,transparent 45.7%),radial-gradient(circle at 80% 22%,#6fb9ff 0 1px,transparent 2px),radial-gradient(circle at 64% 62%,#fff 0 1px,transparent 2px); background-size:auto,82px 82px,111px 111px; }
      .login-eyebrow { display:inline-flex; align-items:center; gap:8px; width:max-content; padding:8px 11px; border:1px solid rgba(113,181,255,.32); border-radius:999px; color:#a9d6ff; background:rgba(6,17,39,.38); font-size:10px; font-weight:900; letter-spacing:1.4px; }
      .login-title { max-width:650px; margin:24px 0 14px; font-size:clamp(38px,5vw,66px); line-height:1.02; letter-spacing:-2.4px; }
      .login-title span { color:#72bbff; }
      .login-copy { max-width:570px; font-size:clamp(15px,1.5vw,18px); }
      .login-route { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:36px; }
      .login-route div { min-width:0; padding:14px; border:1px solid rgba(111,164,230,.22); border-radius:15px; background:rgba(4,12,29,.43); }
      .login-route b { display:block; color:#fff; font-size:12px; }
      .login-route small { display:block; margin-top:5px; color:#7890b5; font-size:10px; }
      .login-trust { display:flex; flex-wrap:wrap; gap:16px; margin-top:30px; color:#83a0c7; font-size:11px; font-weight:700; }
      .login-trust span::before { content:"✓"; margin-right:7px; color:#65e3a1; }
      .login-access { display:flex; flex-direction:column; justify-content:center; padding:clamp(30px,4.5vw,60px); background:linear-gradient(180deg,rgba(7,13,29,.68),rgba(5,10,23,.92)); }
      .login-access-icon { width:50px; height:50px; display:grid; place-items:center; border:1px solid #31598c; border-radius:15px; color:#8dcbff; background:#0b1b37; font-size:22px; box-shadow:0 12px 30px rgba(0,0,0,.28); }
      .login-access h2 { margin:20px 0 7px; font-size:clamp(27px,3vw,36px); }
      .admin-form { display:grid; gap:16px; width:100%; margin-top:27px; }
      .admin-label { display:grid; gap:8px; color:#b8c8e4; font-size:12px; font-weight:800; letter-spacing:.2px; }
      .field-wrap { position:relative; }
      .field-icon { position:absolute; left:15px; top:50%; transform:translateY(-50%); color:#6684b1; font:800 14px/1 monospace; }
      .admin-input { width:100%; min-height:52px; border:1px solid #304d78; border-radius:13px; padding:0 44px; color:#f5f9ff; background:#060d1d; font:650 15px/1 "Segoe UI"; outline:none; transition:border-color .18s,box-shadow .18s,background .18s; }
      .admin-input:hover { border-color:#41699f; }
      .admin-input:focus { border-color:#58aaff; background:#081226; box-shadow:0 0 0 4px rgba(66,160,255,.13); }
      .field-action { position:absolute; right:9px; top:50%; transform:translateY(-50%); width:35px; height:35px; border:0; border-radius:9px; color:#8198ba; background:transparent; cursor:pointer; font-size:15px; }
      .field-action:hover { color:#fff; background:#142441; }
      .admin-button { min-height:50px; border:0; border-radius:13px; padding:0 20px; cursor:pointer; color:#fff; background:linear-gradient(135deg,#286fe2,#2357c5); font:900 13px/1 "Segoe UI"; letter-spacing:.5px; box-shadow:0 10px 24px rgba(15,78,190,.24); transition:transform .15s,filter .15s,background .15s; }
      .admin-button:hover { filter:brightness(1.12); transform:translateY(-1px); }
      .admin-button:disabled { cursor:not-allowed; opacity:.55; transform:none; }
      .admin-button.danger { background:linear-gradient(135deg,#f05a3d,#c52b47); min-width:230px; }
      .admin-button.ghost { min-height:40px; color:#b9cae6; border:1px solid #304a73; background:#101a31; box-shadow:none; }
      .login-submit { width:100%; margin-top:3px; }
      .login-security { display:flex; align-items:flex-start; gap:10px; margin-top:20px; padding:12px 13px; border:1px solid #203b62; border-radius:12px; color:#7f97bb; background:rgba(11,27,54,.52); font-size:11px; line-height:1.5; }
      .admin-alert { display:none; margin-top:14px; padding:12px 14px; border-radius:11px; background:#4a1f2a; border:1px solid #a74659; color:#ffd5dc; }
      .admin-alert.visible { display:block; }
      .dashboard-card { padding:clamp(22px,3vw,36px); }
      .dashboard-header { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
      .dashboard-kicker { display:block; margin-bottom:7px; color:#70b9ff; font-size:10px; font-weight:900; letter-spacing:1.6px; }
      .dashboard-header h2 { margin:0 0 7px; font-size:clamp(27px,3vw,38px); }
      .dashboard-actions { display:flex; align-items:center; gap:10px; }
      .metric-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:25px; }
      .metric-card { display:flex; align-items:center; gap:13px; min-width:0; padding:15px 16px; border:1px solid #243f66; border-radius:16px; background:linear-gradient(145deg,rgba(12,26,51,.82),rgba(7,14,30,.72)); }
      .metric-icon { flex:0 0 auto; width:39px; height:39px; display:grid; place-items:center; border-radius:12px; color:#85c7ff; background:#10284f; font-weight:900; }
      .metric-card small { display:block; color:#748aac; font-size:9px; font-weight:900; letter-spacing:1px; }
      .metric-card strong { display:block; margin-top:4px; overflow:hidden; color:#eef6ff; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
      .admin-grid { display:grid; grid-template-columns:minmax(320px,.82fr) minmax(0,1.18fr); gap:16px; margin-top:16px; }
      .admin-panel { min-width:0; border:1px solid #243f66; border-radius:18px; padding:20px; background:rgba(5,11,25,.74); }
      .admin-panel > .admin-label .admin-input { padding:0 14px; }
      .panel-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:17px; }
      .panel-heading strong { font-size:14px; }
      .panel-heading small { color:#7086a9; font-size:10px; }
      .pipeline { display:grid; gap:8px; margin:18px 0 0; }
      .pipeline-step { display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:10px; padding:9px 10px; border:1px solid transparent; border-radius:11px; color:#8ea2c2; background:rgba(10,21,42,.42); }
      .pipeline-index { width:26px; height:26px; display:grid; place-items:center; border:1px solid #2c4a75; border-radius:8px; color:#7c96bd; font-size:10px; font-weight:900; }
      .pipeline-step b { color:#bac9df; font-size:11px; }
      .pipeline-state { font-size:9px; font-weight:900; letter-spacing:.7px; }
      .pipeline-step.active { border-color:#3c6aa4; color:#8fcdff; background:rgba(32,91,172,.12); }
      .pipeline-step.active .pipeline-index { color:#061224; border-color:#71baff; background:#71baff; }
      .pipeline-step.complete { color:#63dfa0; }
      .pipeline-step.complete .pipeline-index { color:#062016; border-color:#5cdb96; background:#5cdb96; }
      .pipeline-step.failed { border-color:#9c3d54; color:#ff8fa0; background:rgba(155,42,68,.12); }
      .pipeline-step.failed .pipeline-index { color:#fff; border-color:#dc536c; background:#b6324d; }
      .admin-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:18px; }
      .terminal { overflow:hidden; padding:0; }
      .terminal-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:49px; padding:0 14px; border-bottom:1px solid #1f3658; background:#081327; }
      .terminal-title { display:flex; align-items:center; gap:8px; color:#8ca5c9; font:800 10px/1 Consolas,monospace; }
      .terminal-lights { display:flex; gap:5px; }
      .terminal-lights i { width:7px; height:7px; border-radius:50%; background:#f05b63; }.terminal-lights i:nth-child(2){background:#e9bd4d}.terminal-lights i:nth-child(3){background:#55cf8a}
      .admin-log { min-height:320px; max-height:450px; overflow:auto; margin:0; padding:17px; border:0; background:#020611; color:#aee0ff; white-space:pre-wrap; word-break:break-word; font:11px/1.6 Consolas,monospace; }
      .terminal-footer { padding:12px 14px; border-top:1px solid #1b3151; background:#071022; }
      .admin-progress { overflow:hidden; height:5px; border-radius:99px; background:#142540; }
      .admin-progress-fill { width:0; height:100%; border-radius:inherit; background:linear-gradient(90deg,#347af0,#67d0ff); transition:width .35s ease; }
      .admin-progress-fill.running { width:72%; background-size:180% 100%; animation:progressFlow 1.2s linear infinite; }
      .admin-progress-fill.success { width:100%; background:#56df99; }.admin-progress-fill.failed{width:100%;background:#f05b72}
      .deploy-meta { display:flex; justify-content:space-between; gap:12px; margin-top:8px; color:#627a9f; font-size:9px; font-weight:800; letter-spacing:.5px; }
      .reports-panel { margin-top:18px; border:1px solid #243f66; border-radius:18px; padding:20px; background:rgba(5,11,25,.74); }
      .report-head { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; }
      .report-head h3 { margin:0 0 5px; font-size:20px; }.report-head p{margin:0}
      .report-filters { display:flex; align-items:flex-end; flex-wrap:wrap; gap:9px; }.report-filters label{display:grid;gap:5px;color:#7f96b9;font-size:9px;font-weight:900;letter-spacing:.7px}
      .report-date { min-height:39px;border:1px solid #304d78;border-radius:10px;padding:0 10px;color:#eaf4ff;background:#071022;color-scheme:dark; }
      .report-metrics { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:17px 0; }.report-stat{padding:13px;border:1px solid #203b60;border-radius:13px;background:#09162b}.report-stat small{display:block;color:#7189ad;font-size:8px;font-weight:900;letter-spacing:.8px}.report-stat strong{display:block;margin-top:5px;color:#fff;font-size:20px}
      .report-table-wrap{overflow:auto;border:1px solid #1f385c;border-radius:13px}.report-table{width:100%;min-width:940px;border-collapse:collapse;font-size:11px}.report-table th{padding:11px 12px;color:#7189ad;background:#071225;text-align:left;font-size:8px;letter-spacing:.8px}.report-table td{padding:11px 12px;border-top:1px solid #162b49;color:#b8c9e1}.report-player{display:flex;align-items:center;gap:9px}.report-avatar{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#142b4e;font-size:19px}.report-player b{display:block;color:#fff}.report-player small{color:#687f9f}.report-empty{text-align:center!important;padding:28px!important;color:#7890b3!important}
      .admin-status { display:inline-flex; align-items:center; gap:8px; padding:7px 11px; border-radius:999px; background:#15233d; color:#9fb2d2; font-size:10px; font-weight:900; letter-spacing:.5px; }
      .admin-status.running { color:#ffe28c; }.admin-status.success{color:#74ecad}.admin-status.failed{color:#ff8c9d}
      .admin-dot { width:7px; height:7px; border-radius:50%; background:currentColor; box-shadow:0 0 9px currentColor; }
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
      @keyframes progressFlow { to { background-position:-180% 0; } }
      #admin-dashboard[hidden], #admin-login[hidden] { display:none; }
      @media (max-width:940px) { .login-card{grid-template-columns:1fr;min-height:0}.login-visual{min-height:380px}.login-access{padding:34px}.admin-grid{grid-template-columns:1fr}.admin-log{min-height:280px}.metric-grid{grid-template-columns:repeat(3,1fr)}.report-metrics{grid-template-columns:repeat(3,1fr)}.report-head{align-items:flex-start;flex-direction:column} }
      @media (max-width:620px) { .admin-shell{width:min(100% - 18px,1240px);padding:10px 0 24px}.admin-nav{min-height:58px;margin-bottom:10px}.admin-brand img{width:42px;height:42px}.admin-brand-copy small{display:none}.admin-pill{max-width:58%;padding:7px 9px;font-size:9px}.admin-card{border-radius:19px}.login-visual{min-height:330px;padding:28px 23px}.login-title{font-size:38px;letter-spacing:-1.5px}.login-route{grid-template-columns:1fr;margin-top:23px}.login-route div{display:flex;align-items:center;justify-content:space-between}.login-route small{margin:0}.login-trust{margin-top:20px}.login-access{padding:28px 22px}.dashboard-card{padding:18px 14px}.dashboard-header{align-items:flex-start}.dashboard-actions .admin-pill{display:none}.metric-grid{grid-template-columns:1fr}.admin-panel{padding:15px}.admin-log{min-height:300px}.pipeline-step{grid-template-columns:27px 1fr}.pipeline-state{display:none}.admin-actions .admin-button{width:100%}.admin-modal{padding:21px}.admin-modal-actions{flex-direction:column-reverse}.admin-modal-actions .admin-button{width:100%}.reports-panel{padding:15px}.report-metrics{grid-template-columns:1fr 1fr}.report-filters{width:100%}.report-filters label{flex:1}.report-date{width:100%} }
    </style>
    <main class="admin-shell">
      <nav class="admin-nav">
        <div class="admin-brand"><img src="/assets/branding/logo.png" alt="Tito Game"><span class="admin-brand-copy"><b>SUPERADMIN</b><small>RELEASE CONTROL</small></span></div>
        <span class="admin-pill">LOCALHOST · DESARROLLO → PRODUCCION</span>
      </nav>
      <section id="admin-login" class="admin-card login-card">
        <div class="login-visual">
          <div>
            <span class="login-eyebrow">● CONTROL DE PUBLICACIONES</span>
            <h1 class="login-title">Despliega Tito Game <span>con confianza.</span></h1>
            <p class="admin-muted login-copy">Una consola privada para validar, versionar y publicar el juego sin salir de tu entorno local.</p>
            <div class="login-route">
              <div><b>01 · VALIDAR</b><small>Build y seguridad</small></div>
              <div><b>02 · VERSIONAR</b><small>Commit y GitHub</small></div>
              <div><b>03 · PUBLICAR</b><small>Liquid Web + Neon</small></div>
            </div>
          </div>
          <div class="login-trust"><span>Solo localhost</span><span>Sesión temporal</span><span>Logs persistentes</span></div>
        </div>
        <div class="login-access">
          <div class="login-access-icon">⌁</div>
          <h2>Iniciar sesión</h2>
          <p class="admin-muted">Ingresa tus credenciales de administrador local.</p>
          <form id="login-form" class="admin-form">
            <label class="admin-label">Usuario
              <span class="field-wrap"><span class="field-icon">@</span><input id="admin-user" class="admin-input" autocomplete="username" value="mike" required></span>
            </label>
            <label class="admin-label">Contraseña
              <span class="field-wrap"><span class="field-icon">◆</span><input id="admin-password" class="admin-input" type="password" autocomplete="current-password" required><button id="toggle-password" class="field-action" type="button" aria-label="Mostrar contraseña">◉</button></span>
            </label>
            <button class="admin-button login-submit" type="submit">ACCEDER AL CENTRO DE CONTROL →</button>
          </form>
          <div id="login-error" class="admin-alert" role="alert"></div>
          <p class="login-security"><span>◈</span><span>Este acceso solo funciona desde esta computadora. El panel permanece deshabilitado en producción.</span></p>
        </div>
      </section>
      <section id="admin-dashboard" class="admin-card dashboard-card" hidden>
        <div class="dashboard-header">
          <div><span class="dashboard-kicker">CENTRO DE OPERACIONES</span><h2>Publicar nueva versión</h2><p class="admin-muted">Del código local a producción, con validaciones y seguimiento en tiempo real.</p></div>
          <div class="dashboard-actions"><span class="admin-pill">SISTEMAS LISTOS</span><button id="logout-button" class="admin-button ghost" type="button">CERRAR SESION</button></div>
        </div>
        <div class="metric-grid">
          <article class="metric-card"><span class="metric-icon">⑂</span><span><small>RAMA DE SALIDA</small><strong>main · GitHub</strong></span></article>
          <article class="metric-card"><span class="metric-icon">◎</span><span><small>DESTINO</small><strong>tito.systemdem.online</strong></span></article>
          <article class="metric-card"><span class="metric-icon">◇</span><span><small>INFRAESTRUCTURA</small><strong>Liquid Web · Neon · PM2</strong></span></article>
        </div>
        <div class="admin-grid">
          <div class="admin-panel">
            <div class="panel-heading"><strong>Preparar publicación</strong><small>RAMA MAIN</small></div>
            <label class="admin-label">Mensaje del commit
              <input id="commit-message" class="admin-input" maxlength="120" value="deploy: mejoras de Tito Game" required>
            </label>
            <div class="pipeline">
              <div class="pipeline-step" data-pipeline-step="validation"><span class="pipeline-index">01</span><b>Typecheck, build y auditoría</b><span class="pipeline-state">PENDIENTE</span></div>
              <div class="pipeline-step" data-pipeline-step="github"><span class="pipeline-index">02</span><b>Commit y push a GitHub</b><span class="pipeline-state">PENDIENTE</span></div>
              <div class="pipeline-step" data-pipeline-step="server"><span class="pipeline-index">03</span><b>Build, migraciones y PM2</b><span class="pipeline-state">PENDIENTE</span></div>
              <div class="pipeline-step" data-pipeline-step="verification"><span class="pipeline-index">04</span><b>Verificación HTTPS y Neon</b><span class="pipeline-state">PENDIENTE</span></div>
            </div>
            <div class="admin-actions"><button id="deploy-button" class="admin-button danger" type="button">PUBLICAR AHORA · PUSH + DEPLOY</button></div>
            <div id="deploy-error" class="admin-alert" role="alert"></div>
          </div>
          <div class="admin-panel terminal">
            <div class="terminal-bar"><span class="terminal-title"><span class="terminal-lights"><i></i><i></i><i></i></span>tito-release-console</span><span id="deploy-status" class="admin-status"><i class="admin-dot"></i>LISTO</span></div>
            <pre id="deploy-log" class="admin-log">$ Consola preparada.
$ Escribe un mensaje y publica cuando estés listo.</pre>
            <div class="terminal-footer">
              <div class="admin-progress"><div id="deploy-progress" class="admin-progress-fill"></div></div>
              <div class="deploy-meta"><span id="deploy-progress-text">SIN TAREAS ACTIVAS</span><span id="last-deploy-time">—</span></div>
            </div>
          </div>
        </div>
        <section class="reports-panel">
          <div class="report-head"><div><span class="dashboard-kicker">JUGADORES Y ACTIVIDAD</span><h3>Informes del juego</h3><p class="admin-muted">Registros, fechas, ingresos, partidas y tiempo jugado.</p></div>
            <div class="report-filters"><label>DESDE<input id="report-from" class="report-date" type="date"></label><label>HASTA<input id="report-to" class="report-date" type="date"></label><button id="report-refresh" class="admin-button ghost" type="button">ACTUALIZAR</button></div>
          </div>
          <div class="report-metrics"><div class="report-stat"><small>JUGADORES</small><strong id="report-total">—</strong></div><div class="report-stat"><small>NUEVOS</small><strong id="report-new">—</strong></div><div class="report-stat"><small>INGRESOS</small><strong id="report-logins">—</strong></div><div class="report-stat"><small>PARTIDAS</small><strong id="report-games">—</strong></div><div class="report-stat"><small>MINUTOS</small><strong id="report-minutes">—</strong></div></div>
          <div class="report-table-wrap"><table class="report-table"><thead><tr><th>JUGADOR</th><th>TELÉFONO</th><th>REGISTRO</th><th>ÚLTIMA ACTIVIDAD</th><th>INGRESOS</th><th>PARTIDAS</th><th>MINUTOS</th><th>PUNTAJE</th></tr></thead><tbody id="player-report-body"><tr><td colspan="8" class="report-empty">Cargando registros…</td></tr></tbody></table></div>
        </section>
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
  document.getElementById('toggle-password')?.addEventListener('click', togglePasswordVisibility);
  document.getElementById('deploy-button')?.addEventListener('click', openDeployModal);
  document.getElementById('logout-button')?.addEventListener('click', logout);
  document.getElementById('report-refresh')?.addEventListener('click', () => void loadPlayerReports());
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
  const button = document.querySelector<HTMLButtonElement>('#login-form button[type="submit"]');
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

function togglePasswordVisibility(): void {
  const input = document.getElementById('admin-password') as HTMLInputElement | null;
  const button = document.getElementById('toggle-password');
  if (!input || !button) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  button.textContent = visible ? '◉' : '◎';
  button.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  input.focus();
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
  void loadPlayerReports();
}

async function loadPlayerReports(): Promise<void> {
  const body = document.getElementById('player-report-body');
  if (body) body.innerHTML = '<tr><td colspan="8" class="report-empty">Actualizando registros…</td></tr>';
  const fromValue = (document.getElementById('report-from') as HTMLInputElement | null)?.value;
  const toValue = (document.getElementById('report-to') as HTMLInputElement | null)?.value;
  const query = new URLSearchParams();
  if (fromValue) query.set('from', new Date(`${fromValue}T00:00:00`).toISOString());
  if (toValue) query.set('to', new Date(`${toValue}T23:59:59.999`).toISOString());
  try {
    renderPlayerReports(await request<PlayerReportData>(`/api/superadmin/players?${query}`));
  } catch (cause) {
    if (body) body.innerHTML = `<tr><td colspan="8" class="report-empty">${escapeHtml(cause instanceof Error ? cause.message : 'No se pudieron cargar los informes')}</td></tr>`;
  }
}

function renderPlayerReports(data: PlayerReportData): void {
  const set = (id: string, value: string): void => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('report-total', data.summary.totalPlayers.toLocaleString('es-MX'));
  set('report-new', data.summary.newPlayers.toLocaleString('es-MX'));
  set('report-logins', data.summary.totalLogins.toLocaleString('es-MX'));
  set('report-games', data.summary.totalGames.toLocaleString('es-MX'));
  set('report-minutes', data.summary.totalMinutes.toLocaleString('es-MX'));
  const icons: Record<string, string> = { explorer: '🧢', fox: '🦊', dragon: '🐲', robot: '🤖', ice: '🧊', fire: '🔥' };
  const date = (value: string | null): string => value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
  const body = document.getElementById('player-report-body');
  if (!body) return;
  body.innerHTML = data.players.length ? data.players.map((player) => `<tr><td><span class="report-player"><span class="report-avatar">${icons[player.avatar] ?? '🎮'}</span><span><b>${escapeHtml(player.name)}</b><small>@${escapeHtml(player.username)}</small></span></span></td><td>${escapeHtml(player.phone ?? '—')}</td><td>${date(player.registeredAt)}</td><td>${date(player.lastActivityAt)}</td><td>${player.logins}</td><td>${player.games} / ${player.completedGames}</td><td>${player.minutesPlayed.toLocaleString('es-MX')}</td><td>${player.score.toLocaleString('es-MX')}</td></tr>`).join('') : '<tr><td colspan="8" class="report-empty">No hay jugadores en este periodo.</td></tr>';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
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
  const progress = document.getElementById('deploy-progress');
  const progressText = document.getElementById('deploy-progress-text');
  const lastDeploy = document.getElementById('last-deploy-time');
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
  if (progress) progress.className = `admin-progress-fill ${job.status}`;
  if (progressText) {
    progressText.textContent =
      job.status === 'running' ? 'PUBLICACION EN CURSO' : job.status === 'success' ? 'PUBLICACION COMPLETADA' : 'REQUIERE REVISION';
  }
  if (lastDeploy) {
    const timestamp = job.finishedAt ?? job.startedAt;
    lastDeploy.textContent = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  }
  updatePipeline(job);
  if (button) button.disabled = job.status === 'running';
  window.clearTimeout(pollTimer);
  if (job.status === 'running') pollTimer = window.setTimeout(() => void pollJob(), 1200);
}

function updatePipeline(job: DeployJob): void {
  const output = job.logs.join('\n');
  const complete = [
    /Creando commit|Push a GitHub|No hay cambios locales/.test(output),
    /Despliegue en Liquid Web/.test(output),
    /Despliegue completado/.test(output),
    job.status === 'success',
  ];
  const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-pipeline-step]'));
  const activeIndex = complete.findIndex((done) => !done);
  steps.forEach((step, index) => {
    const state = step.querySelector<HTMLElement>('.pipeline-state');
    step.classList.remove('active', 'complete', 'failed');
    if (complete[index]) {
      step.classList.add('complete');
      if (state) state.textContent = 'LISTO';
    } else if (index === activeIndex && job.status === 'running') {
      step.classList.add('active');
      if (state) state.textContent = 'EN CURSO';
    } else if (index === activeIndex && job.status === 'failed') {
      step.classList.add('failed');
      if (state) state.textContent = 'FALLO';
    } else if (state) {
      state.textContent = 'PENDIENTE';
    }
  });
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
  const progress = document.getElementById('deploy-progress');
  const progressText = document.getElementById('deploy-progress-text');
  if (status) {
    status.className = 'admin-status reconnecting';
    status.innerHTML = '<i class="admin-dot"></i>RECONECTANDO';
  }
  if (progress) progress.className = 'admin-progress-fill running';
  if (progressText) progressText.textContent = 'RECONECTANDO CON LA API';
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
