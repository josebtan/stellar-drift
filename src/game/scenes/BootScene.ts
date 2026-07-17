import Phaser from "phaser";
import sunSpritesheet from "../../assets/celestial/sun-spritesheet.png";
import asteroidSpritesheet from "../../assets/celestial/asteroid/asteroid-spritesheet.png";
import minerShip from "../../assets/ship/miner-ship.png";
import tradeStation from "../../assets/station/orion-trade-station.png";
import minimapFrame from "../../assets/ui/minimap-frame.png";
import fuelBar from "../../assets/ui/hud/fuel-bar.png";
import energyBar from "../../assets/ui/hud/energy-bar.png";
import oxygenBar from "../../assets/ui/hud/oxygen-bar.png";
import inventoryPanel from "../../assets/ui/hud/inventory-panel.png";
import powerupShield from "../../assets/ui/hud/powerup-shield.png";
import powerupSpeed from "../../assets/ui/hud/powerup-speed.png";
import powerupWeapon from "../../assets/ui/hud/powerup-weapon.png";
import emergencyCall from "../../assets/ui/hud/emergency-call.png";
import shieldBurst from "../../assets/ui/effects/shield-burst.png";
import oreIron from "../../assets/resources/ore-iron.png";
import oreIce from "../../assets/resources/ore-ice.png";
import oreRare from "../../assets/resources/ore-rareMineral.png";
import { PLANET_CATALOG } from "../planetCatalog";
import {
  SUN_FRAME_WIDTH,
  SUN_FRAME_HEIGHT,
  SUN_FRAME_COUNT,
  ASTEROID_FRAME_SIZE,
  SHIELD_BURST_FRAME_SIZE,
  SHIELD_BURST_FRAME_COUNT,
} from "../assetConstants";

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
      frameWidth: SUN_FRAME_WIDTH,
      frameHeight: SUN_FRAME_HEIGHT,
    });

    // El spritesheet de asteroides no es una animación: cada frame es un
    // MODELO distinto (forma/tamaño propios), elegido al azar por asteroide.
    this.load.spritesheet("asteroid", asteroidSpritesheet, {
      frameWidth: ASTEROID_FRAME_SIZE,
      frameHeight: ASTEROID_FRAME_SIZE,
    });

    this.load.spritesheet("shield-burst", shieldBurst, {
      frameWidth: SHIELD_BURST_FRAME_SIZE,
      frameHeight: SHIELD_BURST_FRAME_SIZE,
    });

    this.load.image("ship-miner", minerShip);
    this.load.image("station-orion", tradeStation);
    this.load.image("minimap-frame", minimapFrame);
    this.load.image("hud-fuel-bar", fuelBar);
    this.load.image("hud-energy-bar", energyBar);
    this.load.image("hud-oxygen-bar", oxygenBar);
    this.load.image("hud-inventory-panel", inventoryPanel);
    this.load.image("hud-powerup-shield", powerupShield);
    this.load.image("hud-powerup-speed", powerupSpeed);
    this.load.image("hud-powerup-weapon", powerupWeapon);
    this.load.image("hud-emergency-call", emergencyCall);
    this.load.image("ore-iron", oreIron);
    this.load.image("ore-ice", oreIce);
    this.load.image("ore-rareMineral", oreRare);

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

    this.anims.create({
      key: "shield-burst-anim",
      frames: this.anims.generateFrameNumbers("shield-burst", { start: 0, end: SHIELD_BURST_FRAME_COUNT - 1 }),
      frameRate: 16,
      repeat: 0,
    });

    this.scene.start("main");
  }
}
