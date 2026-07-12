import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MainScene } from "./scenes/MainScene";

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: "Stellar Drift",
  parent: "app",
  backgroundColor: "#02030a",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 }, // la gravedad real la maneja GravitySystem, no arcade physics
      debug: false,
    },
  },
  scene: [BootScene, MainScene],
};
