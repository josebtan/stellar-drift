import Phaser from "phaser";
import sunSpritesheet from "../../assets/celestial/sun-spritesheet.png";
import asteroidSpritesheet from "../../assets/celestial/asteroid/asteroid-spritesheet.png";
import { PLANET_CATALOG } from "../planetCatalog";
import { SUN_FRAME_SIZE, SUN_FRAME_COUNT, ASTEROID_FRAME_SIZE } from "../assetConstants";

// La generación procedural puede elegir cualquier planeta del catálogo para
// cualquier sistema estelar, así que precargamos los 16 sprites disponibles.
// eager:true resuelve las URLs en build time (con hash de Vite y el base
// path correcto para GitHub Pages).
const planetModules = import.meta.glob<string>("../../assets/celestial/planets/*.png", {
  eager: true,
  import: "default",
});
const catalogKeys = new Set(PLANET_CATALOG.map((p) => p.key));

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.spritesheet("sun", sunSpritesheet, {
      frameWidth: SUN_FRAME_SIZE,
      frameHeight: SUN_FRAME_SIZE,
    });

    // El spritesheet de asteroides no es una animación: cada frame es un
    // MODELO distinto (forma/tamaño propios), elegido al azar por asteroide.
    this.load.spritesheet("asteroid", asteroidSpritesheet, {
      frameWidth: ASTEROID_FRAME_SIZE,
      frameHeight: ASTEROID_FRAME_SIZE,
    });

    for (const [path, url] of Object.entries(planetModules)) {
      // "../../assets/celestial/planets/planet_18.png" -> "planet_18"
      const key = path.split("/").pop()!.replace(".png", "");
      if (catalogKeys.has(key)) {
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
