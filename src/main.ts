import Phaser from "phaser";
import { GAME_CONFIG } from "./game/config";
import { mountAuthScreen } from "./ui/AuthScreen";

const app = document.querySelector<HTMLDivElement>("#app")!;

function startGame(uid: string) {
  // El uid queda disponible globalmente de forma simple para el MVP;
  // en una siguiente iteración se inyectará vía un PlayerSession/registry de Phaser.
  (window as unknown as { currentPlayerUid: string }).currentPlayerUid = uid;
  new Phaser.Game(GAME_CONFIG);
}

function showFatalError(err: unknown) {
  console.error("Error fatal al iniciar Stellar Drift:", err);
  app.innerHTML = `
    <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:#02030a; color:#ff8080; font-family: monospace; padding:24px; text-align:center;">
      <div>
        <p style="font-size:16px;">⚠️ No se pudo iniciar Stellar Drift.</p>
        <p style="font-size:12px; color:#bfe8ff;">Revisa la consola del navegador para más detalle.</p>
      </div>
    </div>`;
}

try {
  mountAuthScreen(app, startGame);
} catch (err) {
  showFatalError(err);
}

window.addEventListener("error", (e) => {
  if (!app.children.length) showFatalError(e.error ?? e.message);
});
