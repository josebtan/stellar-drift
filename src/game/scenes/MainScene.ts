import Phaser from "phaser";
import { GravitySystem } from "../physics/GravitySystem";
import { CelestialBody } from "../entities/CelestialBody";
import { PlayerShip } from "../entities/PlayerShip";
import { Asteroid } from "../entities/Asteroid";
import { Inventory } from "../systems/Inventory";
import type { ResourceType } from "../entities/Asteroid";
import { PLANET_DEFINITIONS, orbitSpeedForDistance } from "../solarSystemConfig";

const WORLD_SIZE = 8000;
const MINING_RANGE = 90;
const MINING_RATE = 15; // unidades por segundo

export class MainScene extends Phaser.Scene {
  private gravity = new GravitySystem();
  private ship!: PlayerShip;
  private celestialBodies: CelestialBody[] = [];
  private asteroids: Asteroid[] = [];
  private inventory = new Inventory();
  private hudText!: Phaser.GameObjects.Text;
  private starfield!: Phaser.GameObjects.TileSprite;

  constructor() {
    super("main");
  }

  create() {
    this.physics.world.setBounds(-WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE * 2, WORLD_SIZE * 2);
    this.cameras.main.setBounds(-WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE * 2, WORLD_SIZE * 2);

    this.createStarfield();
    this.createSolarSystem();
    this.createAsteroidField();

    this.ship = new PlayerShip(this, 400, 0);
    this.cameras.main.startFollow(this.ship, true, 0.08, 0.08);
    this.cameras.main.setZoom(1);

    this.createHud();

    this.input.keyboard!.on("keydown-SPACE", () => this.tryMine());
  }

  private createStarfield() {
    this.starfield = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, undefined as unknown as string)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-10);
    // Sustituido por un fondo de puntos generado proceduralmente:
    this.starfield.destroy();
    this.generateProceduralStars();
  }

  private generateProceduralStars() {
    const g = this.add.graphics({ x: 0, y: 0 });
    g.setDepth(-10);
    g.setScrollFactor(0.15); // parallax leve
    g.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 400; i++) {
      const x = Phaser.Math.Between(-WORLD_SIZE, WORLD_SIZE);
      const y = Phaser.Math.Between(-WORLD_SIZE, WORLD_SIZE);
      const r = Phaser.Math.FloatBetween(0.5, 1.6);
      g.fillCircle(x, y, r);
    }
  }

  private createSolarSystem() {
    // Estrella central
    const star = new CelestialBody(this, {
      type: "star",
      x: 0,
      y: 0,
      radius: 120,
      mass: 400,
      color: 0xffd27f,
      influenceRadius: 7000,
    });
    this.celestialBodies.push(star);
    this.gravity.registerMassiveBody(star.config);

    // Planetas con órbita fija alrededor de la estrella. La velocidad angular
    // se deriva de la distancia (ver orbitSpeedForDistance) para que los
    // planetas lejanos giren más lento, como en un sistema real.
    for (const def of PLANET_DEFINITIONS) {
      const planet = new CelestialBody(this, {
        type: "planet",
        x: def.orbitDistance,
        y: 0,
        radius: def.radius,
        mass: def.mass,
        color: 0xffffff,
        influenceRadius: def.influenceRadius,
        spriteKey: def.spriteKey,
        orbitCenter: { x: 0, y: 0 },
        orbitDistance: def.orbitDistance,
        orbitSpeed: orbitSpeedForDistance(def.orbitDistance),
      });
      this.celestialBodies.push(planet);
      this.gravity.registerMassiveBody(planet.config);
    }
  }

  private createAsteroidField() {
    const types: ResourceType[] = ["iron", "ice", "rareMineral"];

    const spawnAsteroid = (dist: number) => {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const type = types[Phaser.Math.Between(0, types.length - 1)];

      const asteroid = new Asteroid(this, {
        x,
        y,
        radius: Phaser.Math.Between(10, 26),
        resourceType: type,
        amount: Phaser.Math.Between(40, 120),
        vx: Phaser.Math.FloatBetween(-15, 15),
        vy: Phaser.Math.FloatBetween(-15, 15),
      });
      this.asteroids.push(asteroid);
    };

    // Cinturón principal, entre la órbita del 4º y 5º planeta (rocoso -> gigante gaseoso)
    for (let i = 0; i < 90; i++) {
      spawnAsteroid(Phaser.Math.FloatBetween(2350, 2900));
    }

    // Dispersos cerca del sistema interior
    for (let i = 0; i < 20; i++) {
      spawnAsteroid(Phaser.Math.FloatBetween(500, 1900));
    }

    // Dispersos en el sistema exterior
    for (let i = 0; i < 15; i++) {
      spawnAsteroid(Phaser.Math.FloatBetween(4700, 6800));
    }
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

  private tryMine() {
    let nearest: Asteroid | null = null;
    let nearestDist = Infinity;

    for (const asteroid of this.asteroids) {
      const d = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, asteroid.x, asteroid.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = asteroid;
      }
    }

    if (nearest && nearestDist <= MINING_RANGE) {
      const extracted = nearest.mine(MINING_RATE);
      this.inventory.add(nearest.resourceType, extracted);
      if (nearest.amountRemaining <= 0) {
        this.asteroids = this.asteroids.filter((a) => a !== nearest);
      }
    }
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05); // clamp para evitar saltos en tabs inactivos

    // Cuerpos celestes (órbitas propias)
    for (const body of this.celestialBodies) body.update(dt);

    // Input + gravedad + integración de la nave
    this.ship.handleInput(dt);
    this.gravity.step(this.ship, dt);
    this.ship.applyVelocity(dt);

    // Gravedad + integración de asteroides
    for (const asteroid of this.asteroids) {
      this.gravity.step(asteroid, dt);
      asteroid.applyVelocity(dt);
    }

    this.inventory.tickLifeSupport(dt);
    this.updateHud();
  }

  private updateHud() {
    const res = this.inventory.getAll();
    const speed = Math.hypot(this.ship.vx, this.ship.vy).toFixed(0);
    this.hudText.setText(
      [
        `Soporte vital: ${this.inventory.lifeSupport.toFixed(0)}%`,
        `Velocidad: ${speed}`,
        `Hierro: ${res.iron.toFixed(0)}  Hielo: ${res.ice.toFixed(0)}  Mineral raro: ${res.rareMineral.toFixed(0)}`,
        `[Flechas/WASD] mover  [ESPACIO] minar asteroide cercano`,
      ].join("\n")
    );
  }
}
