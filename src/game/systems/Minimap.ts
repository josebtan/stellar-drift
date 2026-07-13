import Phaser from "phaser";
import type { CelestialBody } from "../entities/CelestialBody";
import type { Asteroid } from "../entities/Asteroid";
import type { SpaceStation } from "../entities/SpaceStation";
import type { PlayerShip } from "../entities/PlayerShip";

const RADIUS_PX = 78; // radio del contenido del minimapa en pantalla (dentro del marco)
const FRAME_DISPLAY_SIZE = 190; // tamaño del marco decorativo
const MARGIN = 14;
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

  constructor(scene: Phaser.Scene, uiLayer?: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.frame = scene.add
      .image(0, 0, "minimap-frame")
      .setScrollFactor(0)
      .setDepth(151)
      .setDisplaySize(FRAME_DISPLAY_SIZE, FRAME_DISPLAY_SIZE);
    uiLayer?.add(this.graphics);
    uiLayer?.add(this.frame);
    this.reposition();
    scene.scale.on("resize", () => this.reposition());
  }

  private reposition() {
    const { width } = this.scene.scale;
    this.centerX = width - MARGIN - FRAME_DISPLAY_SIZE / 2;
    this.centerY = MARGIN + FRAME_DISPLAY_SIZE / 2;
    this.frame.setPosition(this.centerX, this.centerY);
  }

  update(
    ship: PlayerShip,
    celestialBodies: readonly CelestialBody[],
    asteroids: readonly Asteroid[],
    stations: readonly SpaceStation[]
  ) {
    const g = this.graphics;
    g.clear();

    g.fillStyle(0x02030a, 0.55);
    g.fillCircle(this.centerX, this.centerY, RADIUS_PX);

    const scale = RADIUS_PX / WORLD_RADIUS;

    for (const body of celestialBodies) {
      const dx = body.x - ship.x;
      const dy = body.y - ship.y;
      if (Math.hypot(dx, dy) > WORLD_RADIUS) continue;
      const isStar = body.config.type === "star";
      g.fillStyle(isStar ? 0xffd27f : 0x9fd9ff, 1);
      g.fillCircle(this.centerX + dx * scale, this.centerY + dy * scale, isStar ? 5 : 2.5);
    }

    for (const station of stations) {
      const dx = station.x - ship.x;
      const dy = station.y - ship.y;
      if (Math.hypot(dx, dy) > WORLD_RADIUS) continue;
      g.fillStyle(0x7CFF9E, 1);
      const px = this.centerX + dx * scale;
      const py = this.centerY + dy * scale;
      g.fillRect(px - 3, py - 3, 6, 6);
    }

    for (const asteroid of asteroids) {
      if (!asteroid.active) continue;
      const dx = asteroid.x - ship.x;
      const dy = asteroid.y - ship.y;
      if (Math.hypot(dx, dy) > ASTEROID_WORLD_RADIUS) continue;
      g.fillStyle(0xb3a48c, 0.85);
      g.fillCircle(this.centerX + dx * scale, this.centerY + dy * scale, 1.5);
    }

    // Nave: punto fijo en el centro + línea indicando hacia dónde apunta
    const dirAngle = ship.rotation - Math.PI / 2;
    g.lineStyle(2, 0x8ce3ff, 1);
    g.lineBetween(
      this.centerX,
      this.centerY,
      this.centerX + Math.cos(dirAngle) * 11,
      this.centerY + Math.sin(dirAngle) * 11
    );
    g.fillStyle(0x8ce3ff, 1);
    g.fillCircle(this.centerX, this.centerY, 4);
  }
}
