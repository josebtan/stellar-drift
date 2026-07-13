import Phaser from "phaser";
import { GravitySystem } from "../physics/GravitySystem";
import { CelestialBody } from "../entities/CelestialBody";
import { Asteroid } from "../entities/Asteroid";
import { SpaceStation } from "../entities/SpaceStation";
import { generateSector, worldToSector, SECTOR_SIZE } from "../procgen/universeGenerator";

/** Radio (en sectores) que se mantiene cargado alrededor de la nave. */
const LOAD_RADIUS = 1; // grid de 3x3 sectores centrado en la nave
/** A partir de qué radio (en sectores) se descarga contenido, para evitar
 * que se cargue/descargue en loop justo al cruzar el límite de un sector. */
const UNLOAD_RADIUS = 2;
/** Cada cuánto (segundos) se revisa si hay que cargar/descargar sectores. */
const CHECK_INTERVAL = 0.75;

interface LoadedSector {
  star: CelestialBody | null;
  planets: CelestialBody[];
  asteroids: Asteroid[];
  station: SpaceStation | null;
}

/**
 * Mantiene el universo "casi infinito": genera sectores proceduralmente al
 * acercarse la nave y destruye (con su gravedad registrada) los que quedan
 * lejos, para que el costo de simulación no crezca sin límite.
 */
export class UniverseStreamer {
  private scene: Phaser.Scene;
  private gravity: GravitySystem;
  private worldLayer?: Phaser.GameObjects.Layer;
  private sectors = new Map<string, LoadedSector>();
  private timeSinceCheck = 0;

  /** Listas planas para que MainScene pueda iterarlas cada frame sin recorrer el Map */
  public celestialBodies: CelestialBody[] = [];
  public asteroids: Asteroid[] = [];
  public stations: SpaceStation[] = [];

  constructor(scene: Phaser.Scene, gravity: GravitySystem, worldLayer?: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.gravity = gravity;
    this.worldLayer = worldLayer;
  }

  /** Debe llamarse una vez al iniciar, para tener contenido antes del primer update. */
  primeAround(x: number, y: number) {
    this.reconcile(x, y);
  }

  update(dt: number, focusX: number, focusY: number) {
    this.timeSinceCheck += dt;
    if (this.timeSinceCheck >= CHECK_INTERVAL) {
      this.timeSinceCheck = 0;
      this.reconcile(focusX, focusY);
    }
  }

  private reconcile(focusX: number, focusY: number) {
    const { sx: centerSX, sy: centerSY } = worldToSector(focusX, focusY);

    const wanted = new Set<string>();
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
        const sx = centerSX + dx;
        const sy = centerSY + dy;
        wanted.add(this.key(sx, sy));
        if (!this.sectors.has(this.key(sx, sy))) {
          this.loadSector(sx, sy);
        }
      }
    }

    // Descarga lo que quedó fuera del radio de descarga (con margen respecto
    // al de carga, para no oscilar en el borde).
    for (const [key, sector] of this.sectors) {
      const [sx, sy] = key.split(",").map(Number);
      const dist = Math.max(Math.abs(sx - centerSX), Math.abs(sy - centerSY));
      if (dist > UNLOAD_RADIUS) {
        this.unloadSector(key, sector);
      }
    }
  }

  private key(sx: number, sy: number) {
    return `${sx},${sy}`;
  }

  private loadSector(sx: number, sy: number) {
    const data = generateSector(sx, sy);
    const loaded: LoadedSector = { star: null, planets: [], asteroids: [], station: null };

    if (data.star) {
      const star = new CelestialBody(this.scene, {
        type: "star",
        x: data.star.x,
        y: data.star.y,
        radius: data.star.radius,
        mass: data.star.mass,
        color: 0xffd27f,
        influenceRadius: data.star.influenceRadius,
      });
      this.gravity.registerMassiveBody(star.config);
      loaded.star = star;
      this.celestialBodies.push(star);
      this.worldLayer?.add(star);

      for (const p of data.planets) {
        const x = data.star.x + Math.cos(p.orbitAngleOffset) * p.orbitDistance;
        const y = data.star.y + Math.sin(p.orbitAngleOffset) * p.orbitDistance;
        const planet = new CelestialBody(this.scene, {
          type: "planet",
          x,
          y,
          radius: p.radius,
          mass: p.mass,
          color: 0xffffff,
          influenceRadius: p.influenceRadius,
          spriteKey: p.spriteKey,
          orbitCenter: { x: data.star.x, y: data.star.y },
          orbitDistance: p.orbitDistance,
          orbitSpeed: p.orbitSpeed,
        });
        this.gravity.registerMassiveBody(planet.config);
        loaded.planets.push(planet);
        this.celestialBodies.push(planet);
        this.worldLayer?.add(planet);
      }

      if (data.station) {
        const station = new SpaceStation(this.scene, data.station.x, data.station.y, data.station.radius);
        loaded.station = station;
        this.stations.push(station);
        this.worldLayer?.add(station);
      }
    }

    for (const a of data.asteroids) {
      const asteroid = new Asteroid(this.scene, {
        x: a.x,
        y: a.y,
        radius: a.radius,
        resourceType: a.resourceType,
        amount: a.amount,
        modelIndex: a.modelIndex,
        vx: a.vx,
        vy: a.vy,
      });
      loaded.asteroids.push(asteroid);
      this.asteroids.push(asteroid);
      this.worldLayer?.add(asteroid);
    }

    this.sectors.set(this.key(sx, sy), loaded);
  }

  private unloadSector(key: string, sector: LoadedSector) {
    if (sector.star) {
      this.gravity.unregisterMassiveBody(sector.star.config);
      this.removeFromList(this.celestialBodies, sector.star);
      sector.star.destroy();
    }
    for (const planet of sector.planets) {
      this.gravity.unregisterMassiveBody(planet.config);
      this.removeFromList(this.celestialBodies, planet);
      planet.destroy();
    }
    for (const asteroid of sector.asteroids) {
      this.removeFromList(this.asteroids, asteroid);
      if (asteroid.active) asteroid.destroy();
    }
    if (sector.station) {
      this.removeFromList(this.stations, sector.station);
      sector.station.destroy();
    }
    this.sectors.delete(key);
  }

  /** Se llama cuando un asteroide se termina de minar, para no dejar
   * referencias colgando en las listas del streamer. */
  notifyAsteroidDepleted(asteroid: Asteroid) {
    this.removeFromList(this.asteroids, asteroid);
    for (const sector of this.sectors.values()) {
      this.removeFromList(sector.asteroids, asteroid);
    }
  }

  private removeFromList<T>(list: T[], item: T) {
    const idx = list.indexOf(item);
    if (idx !== -1) list.splice(idx, 1);
  }
}

export { SECTOR_SIZE };
