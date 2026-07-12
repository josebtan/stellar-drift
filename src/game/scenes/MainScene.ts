import Phaser from "phaser";
import { GravitySystem } from "../physics/GravitySystem";
import { PlayerShip } from "../entities/PlayerShip";
import { Asteroid } from "../entities/Asteroid";
import { Inventory } from "../systems/Inventory";
import { UniverseStreamer } from "../systems/UniverseStreamer";
import { checkCollisions } from "../systems/CollisionSystem";
import { worldToSector } from "../procgen/universeGenerator";

const MINING_RANGE = 90;
const MINING_RATE = 15; // unidades por segundo
const STAR_TILE_SIZE = 512;
const SHIP_SPAWN_X = 400;
const SHIP_SPAWN_Y = 0;

export class MainScene extends Phaser.Scene {
  private gravity = new GravitySystem();
  private universe!: UniverseStreamer;
  private ship!: PlayerShip;
  private inventory = new Inventory();
  private hudText!: Phaser.GameObjects.Text;
  private starTile!: Phaser.GameObjects.TileSprite;
  private gameOverGroup!: Phaser.GameObjects.Container;
  private isGameOver = false;

  constructor() {
    super("main");
  }

  create() {
    // Sin world bounds ni camera bounds: el universo es (casi) infinito,
    // así que no hay un rectángulo fijo que lo contenga.
    this.createStarfield();

    this.universe = new UniverseStreamer(this, this.gravity);
    this.universe.primeAround(SHIP_SPAWN_X, SHIP_SPAWN_Y);

    this.ship = new PlayerShip(this, SHIP_SPAWN_X, SHIP_SPAWN_Y);
    this.cameras.main.startFollow(this.ship, true, 0.08, 0.08);
    this.cameras.main.setZoom(1);

    this.createHud();
    this.createGameOverOverlay();

    this.input.keyboard!.on("keydown-SPACE", () => this.tryMine());
    this.input.keyboard!.on("keydown-R", () => {
      if (this.isGameOver) this.respawnShip();
    });
  }

  private createStarfield() {
    // Textura pequeña con puntos aleatorios, usada como tile infinito. Al no
    // depender de un WORLD_SIZE fijo, funciona igual de bien cerca del
    // origen que a millones de unidades de distancia.
    const gfx = this.add.graphics();
    for (let i = 0; i < 140; i++) {
      const x = Phaser.Math.Between(0, STAR_TILE_SIZE);
      const y = Phaser.Math.Between(0, STAR_TILE_SIZE);
      const r = Phaser.Math.FloatBetween(0.5, 1.6);
      const alpha = Phaser.Math.FloatBetween(0.3, 1);
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(x, y, r);
    }
    gfx.generateTexture("starfield-tile", STAR_TILE_SIZE, STAR_TILE_SIZE);
    gfx.destroy();

    this.starTile = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "starfield-tile")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10);
  }

  private createHud() {
    this.hudText = this.add
      .text(16, 16, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#bfe8ff",
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  private createGameOverOverlay() {
    const { width, height } = this.scale;
    const bg = this.add.rectangle(0, 0, width, height, 0x02030a, 0.85).setOrigin(0, 0);
    const title = this.add
      .text(width / 2, height / 2 - 40, "NAVE DESTRUIDA", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ff6b6b",
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(width / 2, height / 2 + 4, "Se perdió la carga recolectada.", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#bfe8ff",
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(width / 2, height / 2 + 34, "Pulsá [R] para reaparecer", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8ce3ff",
      })
      .setOrigin(0.5);

    this.gameOverGroup = this.add.container(0, 0, [bg, title, subtitle, hint]);
    this.gameOverGroup.setScrollFactor(0).setDepth(200).setVisible(false);

    // Mantiene el overlay del tamaño de la ventana si hay resize
    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      bg.setSize(size.width, size.height);
      title.setPosition(size.width / 2, size.height / 2 - 40);
      subtitle.setPosition(size.width / 2, size.height / 2 + 4);
      hint.setPosition(size.width / 2, size.height / 2 + 34);
    });
  }

  private showGameOver() {
    this.isGameOver = true;
    this.gameOverGroup.setVisible(true);
  }

  private respawnShip() {
    this.isGameOver = false;
    this.gameOverGroup.setVisible(false);
    this.ship.respawn(SHIP_SPAWN_X, SHIP_SPAWN_Y);
    this.inventory.reset();
  }

  private tryMine() {
    if (this.isGameOver) return;

    let nearest: Asteroid | null = null;
    let nearestDist = Infinity;

    for (const asteroid of this.universe.asteroids) {
      const d = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, asteroid.x, asteroid.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = asteroid;
      }
    }

    if (nearest && nearestDist <= MINING_RANGE) {
      const extracted = nearest.mine(MINING_RATE);
      this.inventory.add(nearest.resourceType, extracted);
      if (!nearest.active) {
        // mine() ya llamó a destroy() internamente al agotarse
        this.universe.notifyAsteroidDepleted(nearest);
      }
    }
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05); // clamp para evitar saltos en tabs inactivos

    // Carga/descarga de sectores según la posición actual de la nave
    this.universe.update(dt, this.ship.x, this.ship.y);

    // Cuerpos celestes (órbitas propias)
    for (const body of this.universe.celestialBodies) body.update(dt);

    this.ship.tickInvulnerability(dt);

    if (!this.ship.isDestroyed) {
      // Input + gravedad + integración de la nave
      this.ship.handleInput(dt);
      this.gravity.step(this.ship, dt);
      this.ship.applyVelocity(dt);
    }

    // Gravedad + integración de asteroides
    for (const asteroid of this.universe.asteroids) {
      this.gravity.step(asteroid, dt);
      asteroid.applyVelocity(dt);
    }

    checkCollisions(this.ship, this.universe.celestialBodies, this.universe.asteroids, {
      onAsteroidDestroyed: (asteroid) => this.universe.notifyAsteroidDepleted(asteroid),
      onShipDestroyed: () => this.showGameOver(),
    });

    if (!this.ship.isDestroyed) {
      this.inventory.tickLifeSupport(dt);
    }
    this.updateStarfield();
    this.updateHud();
  }

  private updateStarfield() {
    // Mantiene el tile del tamaño de la ventana (por si hubo resize) y lo
    // desplaza con leve paralaje respecto a la cámara.
    this.starTile.setSize(this.scale.width, this.scale.height);
    this.starTile.tilePositionX = this.cameras.main.scrollX * 0.15;
    this.starTile.tilePositionY = this.cameras.main.scrollY * 0.15;
  }

  private updateHud() {
    const res = this.inventory.getAll();
    const speed = Math.hypot(this.ship.vx, this.ship.vy).toFixed(0);
    const { sx, sy } = worldToSector(this.ship.x, this.ship.y);
    this.hudText.setText(
      [
        `Casco: ${this.ship.hull.toFixed(0)}%   Soporte vital: ${this.inventory.lifeSupport.toFixed(0)}%`,
        `Velocidad: ${speed}`,
        `Sector: ${sx}, ${sy}`,
        `Hierro: ${res.iron.toFixed(0)}  Hielo: ${res.ice.toFixed(0)}  Mineral raro: ${res.rareMineral.toFixed(0)}`,
        `[Flechas/WASD] mover  [ESPACIO] minar asteroide cercano`,
      ].join("\n")
    );
  }
}
