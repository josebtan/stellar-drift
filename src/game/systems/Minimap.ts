import Phaser from "phaser";
import type { CelestialBody } from "../entities/CelestialBody";
import type { Asteroid } from "../entities/Asteroid";
import type { SpaceStation } from "../entities/SpaceStation";
import type { PlayerShip } from "../entities/PlayerShip";
import { getUiScale } from "../uiScale";

const BASE_RADIUS_PX = 78; // radio del contenido del minimapa en pantalla (dentro del marco), a escala 1
const BASE_FRAME_DISPLAY_SIZE = 190; // tamaño del marco decorativo, a escala 1
const BASE_MARGIN = 14;
const WORLD_RADIUS = 6000; // hasta dónde se ven astros
const ASTEROID_WORLD_RADIUS = 3200; // los asteroides se ven a menor distancia (evita saturar)

/**
 * Minimapa circular fijo en una esquina de la pantalla. La nave siempre
 * está en el centro (igual que en la cámara principal); todo lo demás se
 * dibuja relativo a su posición actual, escalado para entrar en el radio.
 */
export class Minimap {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private frame: Phaser.GameObjects.Image;
  private centerX = 0;
  private centerY = 0;
  private radiusPx = BASE_RADIUS_PX;

  constructor(scene: Phaser.Scene, uiLayer?: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.frame = scene.add.image(0, 0, "minimap-frame").setScrollFactor(0).setDepth(151);
    uiLayer?.add(this.graphics);
    uiLayer?.add(this.frame);
    this.reposition();
    scene.scale.on("resize", () => this.reposition());
  }

  private reposition() {
    const { width } = this.scene.scale;
    const scale = getUiScale(this.scene);
    const frameSize = BASE_FRAME_DISPLAY_SIZE * scale;
    const margin = BASE_MARGIN * scale;
    this.radiusPx = BASE_RADIUS_PX * scale;
    this.centerX = width - margin - frameSize / 2;
    this.centerY = margin + frameSize / 2;
    this.frame.setPosition(this.centerX, this.centerY).setDisplaySize(frameSize, frameSize);
  }

  update(
    ship: PlayerShip,
    celestialBodies: readonly CelestialBody[],
    asteroids: readonly Asteroid[],
    stations: readonly SpaceStation[]
  ) {
    const g = this.graphics;
    g.clear();
    const dotScale = this.radiusPx / BASE_RADIUS_PX;

    g.fillStyle(0x02030a, 0.55);
    g.fillCircle(this.centerX, this.centerY, this.radiusPx);

    const scale = this.radiusPx / WORLD_RADIUS;

    for (const body of celestialBodies) {
      const dx = body.x - ship.x;
      const dy = body.y - ship.y;
      if (Math.hypot(dx, dy) > WORLD_RADIUS) continue;
      const isStar = body.config.type === "star";
      g.fillStyle(isStar ? 0xffd27f : 0x9fd9ff, 1);
      g.fillCircle(this.centerX + dx * scale, this.centerY + dy * scale, (isStar ? 5 : 2.5) * dotScale);
    }

    for (const station of stations) {
      const dx = station.x - ship.x;
      const dy = station.y - ship.y;
      if (Math.hypot(dx, dy) > WORLD_RADIUS) continue;
      g.fillStyle(0x7CFF9E, 1);
      const px = this.centerX + dx * scale;
      const py = this.centerY + dy * scale;
      const s = 3 * dotScale;
      g.fillRect(px - s, py - s, s * 2, s * 2);
    }

    for (const asteroid of asteroids) {
      if (!asteroid.active) continue;
      const dx = asteroid.x - ship.x;
      const dy = asteroid.y - ship.y;
      if (Math.hypot(dx, dy) > ASTEROID_WORLD_RADIUS) continue;
      g.fillStyle(0xb3a48c, 0.85);
      g.fillCircle(this.centerX + dx * scale, this.centerY + dy * scale, 1.5 * dotScale);
    }

    // Nave: punto fijo en el centro + línea indicando hacia dónde apunta
    const dirAngle = ship.rotation - Math.PI / 2;
    g.lineStyle(2, 0x8ce3ff, 1);
    g.lineBetween(
      this.centerX,
      this.centerY,
      this.centerX + Math.cos(dirAngle) * 11 * dotScale,
      this.centerY + Math.sin(dirAngle) * 11 * dotScale
    );
    g.fillStyle(0x8ce3ff, 1);
    g.fillCircle(this.centerX, this.centerY, 4 * dotScale);
  }
}
