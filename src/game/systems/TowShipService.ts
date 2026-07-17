import Phaser from "phaser";
import { TowShip } from "../entities/TowShip";
import type { PlayerShip } from "../entities/PlayerShip";
import type { Inventory } from "./Inventory";

/** Créditos que cobra el servicio de grúa por venir a recargar combustible. */
export const TOW_SERVICE_COST = 50;

/** Velocidad base de acercamiento; si la nave del jugador va a la deriva
 * más rápido que esto, se recalcula más arriba (ver updateApproaching) para
 * que la grúa siempre gane la carrera y la alcance. */
const APPROACH_SPEED = 340;
/** Margen por encima de la velocidad actual de la nave a la que persigue,
 * para garantizar que siempre la alcance sin importar qué tan rápido derive. */
const APPROACH_CATCHUP_MARGIN = 150;
const LEAVE_SPEED = 420; // se va un poco más rápido de lo que vino
/** Distancia a la nave del jugador a la que la grúa se detiene a recargar. */
const PARK_DISTANCE = 75;
/** Combustible por segundo mientras recarga — rápido, como pidió el diseño. */
const REFUEL_RATE = 45;
/** Margen extra (unidades de mundo) más allá del borde de cámara antes de
 * dar por "fuera de pantalla" (tanto para spawnear como para despawnear). */
const OFFSCREEN_MARGIN = 80;

type ServiceState = "idle" | "approaching" | "refueling" | "leaving";

/**
 * Contrata y gestiona la nave de auxilio: aparece fuera de pantalla, se
 * acerca a la nave del jugador, se detiene junto a ella y le recarga el
 * combustible; al terminar se aleja por donde vino y desaparece al salir
 * de la vista de la cámara.
 */
export class TowShipService {
  private scene: Phaser.Scene;
  private worldLayer: Phaser.GameObjects.Layer;
  private ship: PlayerShip;
  private inventory: Inventory;

  private towShip: TowShip | null = null;
  private state: ServiceState = "idle";
  /** Dirección (unitaria) por la que vino la grúa; al irse usa la opuesta. */
  private travelDir = { x: 0, y: 0 };
  /** Offset respecto a la nave del jugador donde queda estacionada, fijado
   * en el momento en que llega — así se mantiene "al lado" aunque el
   * jugador derive por la gravedad mientras no tiene combustible. */
  private parkOffset = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, worldLayer: Phaser.GameObjects.Layer, ship: PlayerShip, inventory: Inventory) {
    this.scene = scene;
    this.worldLayer = worldLayer;
    this.ship = ship;
    this.inventory = inventory;
  }

  get isActive() {
    return this.state !== "idle";
  }

  /** Intenta contratar el servicio. Devuelve false si ya hay uno en curso
   * o si no alcanzan los créditos. */
  hire(): boolean {
    if (this.isActive) return false;
    if (!this.inventory.spendCredits(TOW_SERVICE_COST)) return false;

    const spawn = this.pickSpawnPoint();
    this.towShip = new TowShip(this.scene, spawn.x, spawn.y);
    this.worldLayer.add(this.towShip);

    const dx = this.ship.x - spawn.x;
    const dy = this.ship.y - spawn.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.travelDir = { x: dx / dist, y: dy / dist };
    this.towShip.faceDirection(this.travelDir.x, this.travelDir.y);

    this.state = "approaching";
    return true;
  }

  /** Punto de aparición fuera de la vista actual de la cámara, en un lado
   * al azar, ya encarado hacia la nave del jugador. */
  private pickSpawnPoint() {
    const cam = this.scene.cameras.main;
    const halfW = cam.width / 2 / cam.zoom + OFFSCREEN_MARGIN;
    const halfH = cam.height / 2 / cam.zoom + OFFSCREEN_MARGIN;

    const side = Phaser.Math.Between(0, 3); // 0:izq 1:der 2:arriba 3:abajo
    const along = Phaser.Math.FloatBetween(-0.6, 0.6); // variación a lo largo del borde
    switch (side) {
      case 0:
        return { x: this.ship.x - halfW, y: this.ship.y + along * halfH };
      case 1:
        return { x: this.ship.x + halfW, y: this.ship.y + along * halfH };
      case 2:
        return { x: this.ship.x + along * halfW, y: this.ship.y - halfH };
      default:
        return { x: this.ship.x + along * halfW, y: this.ship.y + halfH };
    }
  }

  update(dt: number) {
    if (!this.towShip) return;

    switch (this.state) {
      case "approaching":
        this.updateApproaching(dt);
        break;
      case "refueling":
        this.updateRefueling(dt);
        break;
      case "leaving":
        this.updateLeaving(dt);
        break;
    }
  }

  private updateApproaching(dt: number) {
    const ts = this.towShip!;
    // Recalcula la dirección hacia la nave del jugador cada frame (en vez
    // de usar la dirección fija de cuando se contrató), así la persigue
    // aunque esté a la deriva por la gravedad sin poder frenar.
    const dx = this.ship.x - ts.x;
    const dy = this.ship.y - ts.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.travelDir = { x: dx / dist, y: dy / dist };
    ts.faceDirection(this.travelDir.x, this.travelDir.y);

    // Nunca más lenta que la nave a la que persigue + margen: así la
    // alcanza siempre, sin importar qué tan rápido esté yendo a la deriva.
    const shipSpeed = Math.hypot(this.ship.vx, this.ship.vy);
    const speed = Math.max(APPROACH_SPEED, shipSpeed + APPROACH_CATCHUP_MARGIN);
    ts.x += this.travelDir.x * speed * dt;
    ts.y += this.travelDir.y * speed * dt;

    if (dist <= PARK_DISTANCE) {
      this.parkOffset = { x: ts.x - this.ship.x, y: ts.y - this.ship.y };
      this.state = "refueling";
    }
  }

  private updateRefueling(dt: number) {
    const ts = this.towShip!;
    // Se mantiene "pegada" a la nave del jugador mientras esta derive.
    ts.x = this.ship.x + this.parkOffset.x;
    ts.y = this.ship.y + this.parkOffset.y;

    this.inventory.refuel(REFUEL_RATE * dt);

    if (this.inventory.fuel >= this.inventory.fuelCapacity) {
      // Se va por donde vino.
      this.travelDir = { x: -this.travelDir.x, y: -this.travelDir.y };
      ts.faceDirection(this.travelDir.x, this.travelDir.y);
      this.state = "leaving";
    }
  }

  private updateLeaving(dt: number) {
    const ts = this.towShip!;
    ts.x += this.travelDir.x * LEAVE_SPEED * dt;
    ts.y += this.travelDir.y * LEAVE_SPEED * dt;

    const cam = this.scene.cameras.main;
    const halfW = cam.width / 2 / cam.zoom + OFFSCREEN_MARGIN;
    const halfH = cam.height / 2 / cam.zoom + OFFSCREEN_MARGIN;
    const dx = Math.abs(ts.x - this.ship.x);
    const dy = Math.abs(ts.y - this.ship.y);
    if (dx > halfW || dy > halfH) {
      ts.destroy();
      this.towShip = null;
      this.state = "idle";
    }
  }
}
