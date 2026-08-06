import { api } from '../systems/ApiClient';

const AVATARS = [
  ['explorer', '🧢'], ['fox', '🦊'], ['dragon', '🐲'],
  ['robot', '🤖'], ['ice', '🧊'], ['fire', '🔥'],
] as const;

export async function openQuickLogin(): Promise<'authenticated' | 'guest' | null> {
  document.getElementById('quick-login-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'quick-login-modal';
  overlay.innerHTML = `
    <style>
      #quick-login-modal{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:16px;background:rgba(2,7,17,.82);backdrop-filter:blur(10px);font-family:Inter,"Segoe UI",sans-serif;color:#eef7ff}
      .ql-card{width:min(470px,100%);max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #3a72b8;border-radius:24px;padding:clamp(21px,5vw,34px);background:linear-gradient(155deg,#142b52,#07101f 72%);box-shadow:0 30px 100px #000b}
      .ql-head{display:flex;justify-content:space-between;gap:16px}.ql-kicker{color:#72c9ff;font-size:10px;font-weight:900;letter-spacing:1.5px}.ql-card h2{margin:8px 0 5px;font-size:clamp(26px,7vw,36px)}.ql-copy{margin:0;color:#9ab0d0;font-size:13px;line-height:1.5}.ql-close{width:38px;height:38px;border:1px solid #34557f;border-radius:11px;color:#adc2df;background:#101d35;cursor:pointer;font-size:20px}
      .ql-form{display:grid;gap:14px;margin-top:22px}.ql-label{display:grid;gap:7px;color:#c2d2e8;font-size:12px;font-weight:800}.ql-input{width:100%;min-height:50px;box-sizing:border-box;border:1px solid #355987;border-radius:13px;padding:0 14px;color:#fff;background:#050c1a;font:650 16px "Segoe UI";outline:none}.ql-input:focus{border-color:#63b8ff;box-shadow:0 0 0 4px #3498ff22}
      .ql-avatars{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.ql-avatar input{position:absolute;opacity:0}.ql-avatar span{display:grid;place-items:center;min-height:50px;border:1px solid #2d4b72;border-radius:13px;background:#0a162a;font-size:25px;cursor:pointer}.ql-avatar input:checked+span{border-color:#ffd75c;background:#183661;box-shadow:0 0 0 3px #ffd75c22;transform:translateY(-2px)}
      .ql-submit,.ql-guest{min-height:50px;border:0;border-radius:13px;cursor:pointer;color:#fff;font-weight:900}.ql-submit{background:linear-gradient(135deg,#2f86ee,#225bd0);box-shadow:0 12px 28px #146bd044}.ql-submit:disabled{opacity:.55}.ql-guest{border:1px solid #38547a;background:#111d34}.ql-error{min-height:18px;color:#ff9baa;font-size:12px;text-align:center}.ql-note{margin:0;color:#7288a9;font-size:10px;text-align:center}
      @media(max-height:520px) and (orientation:landscape){#quick-login-modal{place-items:start center;padding:8px}.ql-card{padding:16px 22px}.ql-card h2{font-size:25px}.ql-form{grid-template-columns:1fr 1fr;margin-top:12px}.ql-avatars{grid-column:1/-1}.ql-submit,.ql-guest,.ql-error,.ql-note{grid-column:1/-1}}
    </style>
    <section class="ql-card" role="dialog" aria-modal="true" aria-labelledby="ql-title">
      <div class="ql-head"><div><span class="ql-kicker">PERFIL DE JUGADOR</span><h2 id="ql-title">Entra en segundos</h2><p class="ql-copy">Guarda tu progreso y aparece en la tabla de posiciones.</p></div><button class="ql-close" type="button" aria-label="Cerrar">×</button></div>
      <form class="ql-form">
        <label class="ql-label">Nombre<input id="ql-name" class="ql-input" maxlength="40" autocomplete="name" placeholder="¿Cómo te llamas?" required></label>
        <label class="ql-label">Teléfono<input id="ql-phone" class="ql-input" type="tel" inputmode="tel" autocomplete="tel" placeholder="614 123 4567" required></label>
        <div class="ql-label">Elige tu avatar<div class="ql-avatars">${AVATARS.map(([id, icon], index) => `<label class="ql-avatar"><input type="radio" name="avatar" value="${id}" ${index === 0 ? 'checked' : ''}><span>${icon}</span></label>`).join('')}</div></div>
        <button class="ql-submit" type="submit">ENTRAR Y GUARDAR PROGRESO</button>
        <button class="ql-guest" type="button">JUGAR COMO INVITADO</button>
        <div class="ql-error" role="alert"></div><p class="ql-note">Ingreso rápido para el juego. No se solicita contraseña.</p>
      </form>
    </section>`;
  document.body.append(overlay);

  return new Promise((resolve) => {
    const finish = (result: 'authenticated' | 'guest' | null): void => { overlay.remove(); resolve(result); };
    overlay.querySelector('.ql-close')?.addEventListener('click', () => finish(null));
    overlay.querySelector('.ql-guest')?.addEventListener('click', () => finish('guest'));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(null); });
    overlay.querySelector('form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = overlay.querySelector<HTMLButtonElement>('.ql-submit')!;
      const error = overlay.querySelector<HTMLElement>('.ql-error')!;
      const name = overlay.querySelector<HTMLInputElement>('#ql-name')!.value.trim();
      const phone = overlay.querySelector<HTMLInputElement>('#ql-phone')!.value.replace(/[^+\d]/g, '');
      const avatar = overlay.querySelector<HTMLInputElement>('input[name="avatar"]:checked')!.value;
      button.disabled = true; error.textContent = 'Conectando...';
      const result = await api.quickLogin(name, phone, avatar);
      if (result) finish('authenticated');
      else { error.textContent = api.lastError || 'No se pudo iniciar sesión'; button.disabled = false; }
    });
    window.setTimeout(() => overlay.querySelector<HTMLInputElement>('#ql-name')?.focus(), 80);
  });
}
