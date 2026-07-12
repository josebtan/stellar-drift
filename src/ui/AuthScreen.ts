import { loginUser, registerUser } from "../services/auth";

/**
 * Pantalla de login/registro renderizada como overlay DOM (no Phaser).
 * Al autenticar con éxito, llama a onSuccess(uid) para que main.ts arranque el juego.
 */
export function mountAuthScreen(container: HTMLElement, onSuccess: (uid: string) => void) {
  container.innerHTML = `
    <div id="auth-screen" style="
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:radial-gradient(circle at 50% 30%, #0c1a33 0%, #02030a 70%);
      color:#bfe8ff; font-family: system-ui, sans-serif; z-index:10;">
      <form id="auth-form" style="
        background:#0a1424; border:1px solid #1c3a5e; border-radius:12px;
        padding:32px; width:300px; display:flex; flex-direction:column; gap:12px;">
        <h1 style="margin:0 0 8px; font-size:20px; letter-spacing:1px;">STELLAR DRIFT</h1>
        <input id="auth-name" type="text" placeholder="Nombre de piloto (solo registro)"
          style="padding:10px; border-radius:6px; border:1px solid #234; background:#03060c; color:#dff;" />
        <input id="auth-email" type="email" placeholder="Email" required
          style="padding:10px; border-radius:6px; border:1px solid #234; background:#03060c; color:#dff;" />
        <input id="auth-password" type="password" placeholder="Contraseña" required
          style="padding:10px; border-radius:6px; border:1px solid #234; background:#03060c; color:#dff;" />
        <div style="display:flex; gap:8px;">
          <button id="btn-login" type="submit" style="flex:1; padding:10px; border-radius:6px; border:none; background:#3a86ff; color:white; cursor:pointer;">Entrar</button>
          <button id="btn-register" type="button" style="flex:1; padding:10px; border-radius:6px; border:none; background:#234; color:#bfe8ff; cursor:pointer;">Registrarse</button>
        </div>
        <p id="auth-error" style="color:#ff6b6b; font-size:13px; min-height:16px; margin:0;"></p>
      </form>
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>("#auth-form")!;
  const emailInput = container.querySelector<HTMLInputElement>("#auth-email")!;
  const passwordInput = container.querySelector<HTMLInputElement>("#auth-password")!;
  const nameInput = container.querySelector<HTMLInputElement>("#auth-name")!;
  const errorEl = container.querySelector<HTMLParagraphElement>("#auth-error")!;
  const registerBtn = container.querySelector<HTMLButtonElement>("#btn-register")!;

  const finish = (uid: string) => {
    container.querySelector("#auth-screen")?.remove();
    onSuccess(uid);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    try {
      const user = await loginUser(emailInput.value, passwordInput.value);
      finish(user.uid);
    } catch (err) {
      errorEl.textContent = "No se pudo iniciar sesión. Verifica tus datos.";
      console.error(err);
    }
  });

  registerBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    if (!nameInput.value.trim()) {
      errorEl.textContent = "Ingresa un nombre de piloto para registrarte.";
      return;
    }
    try {
      const user = await registerUser(emailInput.value, passwordInput.value, nameInput.value.trim());
      finish(user.uid);
    } catch (err) {
      errorEl.textContent = "No se pudo registrar. ¿Email ya en uso o contraseña débil?";
      console.error(err);
    }
  });
}
