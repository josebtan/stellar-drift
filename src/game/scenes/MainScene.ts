import Phaser from "phaser";
import { GravitySystem } from "../physics/GravitySystem";
import { PlayerShip } from "../entities/PlayerShip";
import { Inventory } from "../systems/Inventory";
import { UniverseStreamer } from "../systems/UniverseStreamer";
import { checkCollisions } from "../systems/CollisionSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { InputController } from "../systems/InputController";
import { Minimap } from "../systems/Minimap";
import { GameHud } from "../ui/GameHud";
import { worldToSector } from "../procgen/universeGenerator";

const STAR_TILE_SIZE = 512;
const SHIP_SPAWN_X = 400;
const SHIP_SPAWN_Y = 0;
const FIRE_COOLDOWN = 0.15; // segundos entre disparos
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.2;
/** Combustible por segundo mientras la nave se impulsa; con el tanque base
 * (100) da ~14s de empuje continuo antes de quedarse sin combustible. */
const FUEL_CONSUMPTION_PER_SEC = 7;

export class MainScene extends Phaser.Scene {
  private gravity = new GravitySystem();
  private universe!: UniverseStreamer;
  private combat!: CombatSystem;
  private input_!: InputController;
  private minimap!: Minimap;
  private ship!: PlayerShip;
  private inventory = new Inventory();
  private gameHud!: GameHud;
  private starTile!: Phaser.GameObjects.TileSprite;
  private gameOverGroup!: Phaser.GameObjects.Container;
  private isGameOver = false;
  private fireCooldown = 0;
  private zoom = 1;

  /** Todo lo que vive en el mundo (nave, astros, asteroides, proyectiles,
   * minerales) — la cámara de UI lo ignora, así el HUD nunca se ve afectado
   * por el zoom del mundo. */
  private worldLayer!: Phaser.GameObjects.Layer;
  /** HUD, minimapa, joysticks táctiles, overlay de game over — la cámara
   * principal (con zoom) los ignora; se renderizan con la cámara de UI,
   * que siempre está fija en zoom 1. */
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super("main");
  }

  create() {
    // Sin world bounds ni camera bounds: el universo es (casi) infinito,
    // así que no hay un rectángulo fijo que lo contenga.
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();

    this.createStarfield();

    this.universe = new UniverseStreamer(this, this.gravity, this.worldLayer);
    this.universe.primeAround(SHIP_SPAWN_X, SHIP_SPAWN_Y);
    this.combat = new CombatSystem(this, this.gravity, this.worldLayer);

    this.ship = new PlayerShip(this, SHIP_SPAWN_X, SHIP_SPAWN_Y);
    this.worldLayer.add(this.ship);
    // lerp=1: la nave queda perfectamente centrada cada frame, sin retraso.
    this.cameras.main.startFollow(this.ship, true, 1, 1);
    this.cameras.main.setZoom(this.zoom);

    this.input_ = new InputController(this, this.uiLayer);
    this.minimap = new Minimap(this, this.uiLayer);

    this.createHud();
    this.createGameOverOverlay();

    // Cámara de UI: fija en (0,0), zoom siempre 1. Cada cámara ignora la
    // capa de la otra, así el HUD/minimapa/joysticks nunca se escalan ni se
    // desplazan con el zoom o el scroll del mundo (setScrollFactor(0) por sí
    // solo NO alcanza para eso: exime del scroll pero no del zoom).
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.cameras.main.ignore(this.uiLayer);
    this.uiCamera.ignore(this.worldLayer);

    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.uiCamera.setSize(size.width, size.height);
    });

    this.input.keyboard!.on("keydown-R", () => {
      if (this.isGameOver) this.respawnShip();
    });
  }

  private createStarfield() {
    // Textura pequeña con puntos aleatorios, usada como tile infinito. Al no
    // depender de un WORLD_SIZE fijo, funciona igual de bien cerca del
    // origen que a millones de unidades de distancia. Vive en la capa de UI
    // (cámara sin zoom): un fondo estelar lejano no debería encogerse o
    // agrandarse al hacer zoom sobre el sistema, solo desplazarse con
    // paralaje — así se ve estable en vez de "saltar" al cambiar el zoom.
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
    this.uiLayer.add(this.starTile);
  }

  private createHud() {
    this.gameHud = new GameHud(this, this.uiLayer);

    const hintText = this.input_?.isTouch
      ? "Joystick izq: mover — Joystick der: apuntar y disparar — Pellizcar: zoom"
      : "WASD: mover — Mouse: apuntar — Click: disparar — Rueda: zoom";
    const hint = this.add
      .text(16, this.scale.height - 22, hintText, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#6f95ad",
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setName("controlsHint");
    this.uiLayer.add(hint);

    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      hint.setPosition(16, size.height - 22);
    });
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
      .text(width / 2, height / 2 + 34, "Pulsá [R] o tocá la pantalla para reaparecer", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8ce3ff",
      })
      .setOrigin(0.5);

    this.gameOverGroup = this.add.container(0, 0, [bg, title, subtitle, hint]);
    this.gameOverGroup.setScrollFactor(0).setDepth(200).setVisible(false);
    this.uiLayer.add(this.gameOverGroup);
    bg.setInteractive().on("pointerdown", () => {
      if (this.isGameOver) this.respawnShip();
    });

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

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05); // clamp para evitar saltos en tabs inactivos

    // Carga/descarga de sectores según la posición actual de la nave
    this.universe.update(dt, this.ship.x, this.ship.y);

    // Cuerpos celestes (órbitas propias)
    for (const body of this.universe.celestialBodies) body.update(dt);

    this.ship.tickInvulnerability(dt);
    this.updateZoom();

    if (!this.ship.isDestroyed) {
      const moveVector = this.input_.getMoveVector();
      const aimAngle = this.input_.getAimAngle();
      this.ship.handleInput(dt, moveVector, aimAngle, this.inventory.hasFuel);
      this.gravity.step(this.ship, dt);
      this.ship.applyVelocity(dt);
      this.handleFiring(dt, aimAngle);
      if (this.ship.isThrusting) {
        this.inventory.consumeFuel(FUEL_CONSUMPTION_PER_SEC * dt);
      }
    }

    // Gravedad + integración de asteroides
    for (const asteroid of this.universe.asteroids) {
      this.gravity.step(asteroid, dt);
      asteroid.applyVelocity(dt);
    }

    this.combat.update(
      dt,
      this.universe.celestialBodies,
      this.universe.asteroids,
      this.ship,
      this.inventory,
      { onAsteroidDestroyed: (asteroid) => this.universe.notifyAsteroidDepleted(asteroid) }
    );

    checkCollisions(this.ship, this.universe.celestialBodies, this.universe.asteroids, {
      onAsteroidDestroyed: (asteroid) => this.universe.notifyAsteroidDepleted(asteroid),
      onShipDestroyed: () => this.showGameOver(),
    });

    if (!this.ship.isDestroyed) {
      this.inventory.tickLifeSupport(dt);
    }
    this.inventory.tickEnergyRegen(dt);

    this.updateStarfield();
    this.minimap.update(this.ship, this.universe.celestialBodies, this.universe.asteroids, this.universe.stations);
    this.input_.redrawTouchControls();

    const { sx, sy } = worldToSector(this.ship.x, this.ship.y);
    this.gameHud.update(this.ship, this.inventory, {
      speed: Math.round(Math.hypot(this.ship.vx, this.ship.vy)),
      zoom: this.zoom,
      sectorX: sx,
      sectorY: sy,
    });
  }

  private handleFiring(dt: number, aimAngle: number | null) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.input_.isFiring() && this.fireCooldown <= 0 && aimAngle !== null) {
      // Dispara desde la punta de la nave, en la dirección que está encarando
      const spawnDist = 20;
      const x = this.ship.x + Math.cos(this.ship.rotation - Math.PI / 2) * spawnDist;
      const y = this.ship.y + Math.sin(this.ship.rotation - Math.PI / 2) * spawnDist;
      this.combat.fire(x, y, this.ship.rotation);
      this.fireCooldown = FIRE_COOLDOWN;
    }
  }

  private updateZoom() {
    const delta = this.input_.consumeZoomDelta();
    if (delta !== 0) {
      this.zoom = Phaser.Math.Clamp(this.zoom + delta, MIN_ZOOM, MAX_ZOOM);
      this.cameras.main.setZoom(this.zoom);
    }
  }

  private updateStarfield() {
    // Mantiene el tile del tamaño de la ventana (por si hubo resize) y lo
    // desplaza con leve paralaje respecto a la cámara.
    this.starTile.setSize(this.scale.width, this.scale.height);
    this.starTile.tilePositionX = this.cameras.main.scrollX * 0.15;
    this.starTile.tilePositionY = this.cameras.main.scrollY * 0.15;
  }

}
