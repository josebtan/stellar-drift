import Phaser from "phaser";
import sunSpritesheet from "../../assets/celestial/sun-spritesheet.png";
import { PLANET_DEFINITIONS } from "../solarSystemConfig";

const SUN_FRAME_SIZE = 330;
const SUN_FRAME_COUNT = 15;

// El catálogo completo vive en /assets/celestial/planets, pero solo
// precargamos los sprites realmente usados en PLANET_DEFINITIONS para no
// bajar ~4MB de planetas sin usar. eager:true resuelve las URLs en build
// time (con hash de Vite y el base path correcto para GitHub Pages).
const planetModules = import.meta.glob<string>("../../assets/celestial/planets/*.png", {
  eager: true,
  import: "default",
});
const usedPlanetKeys = new Set(PLANET_DEFINITIONS.map((def) => def.spriteKey));

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.spritesheet("sun", sunSpritesheet, {
      frameWidth: SUN_FRAME_SIZE,
      frameHeight: SUN_FRAME_SIZE,
    });

    for (const [path, url] of Object.entries(planetModules)) {
      // "../../assets/celestial/planets/planet_18.png" -> "planet_18"
      const key = path.split("/").pop()!.replace(".png", "");
      if (usedPlanetKeys.has(key)) {
        this.load.image(key, url);
      }
    }
  }

  create() {
    this.anims.create({
      key: "sun-glow",
      frames: this.anims.generateFrameNumbers("sun", { start: 0, end: SUN_FRAME_COUNT - 1 }),
      frameRate: 12,
      repeat: -1,
    });

    this.scene.start("main");
  }
}
