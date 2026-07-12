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

mountAuthScreen(app, startGame);
