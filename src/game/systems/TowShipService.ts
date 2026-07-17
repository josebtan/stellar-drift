import Phaser from "phaser";
import { TowShip } from "../entities/TowShip";
import type { PlayerShip } from "../entities/PlayerShip";
import type { Inventory } from "./Inventory";

/** Créditos que cobra el servicio de grúa por venir a recargar combustible. */
export const TOW_SERVICE_COST = 50;

const APPROACH_SPEED = 340; // px/s, en el espacio RELATIVO a la nave
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
 *
 * El movimiento se calcula por completo como un OFFSET relativo a la nave
 * del jugador (posición mundial = nave.posición + offset), igual que si la
 * grúa fuera un objeto hijo de la nave. Así hereda automáticamente
 * cualquier deriva/velocidad de la nave sin tener que perseguirla ni
 * calcular intercepciones: nunca puede "quedarse atrás" porque su posición
 * siempre parte de la posición actual de la nave.
 */
export class TowShipService {
  private scene: Phaser.Scene;
  private worldLayer: Phaser.GameObjects.Layer;
  private ship: PlayerShip;
  private inventory: Inventory;

  private towShip: TowShip | null = null;
  private state: ServiceState = "idle";
  /** Offset actual respecto a la nave del jugador (posición mundial de la
   * grúa = ship.x + offset.x, ship.y + offset.y). */
  private offset = { x: 0, y: 0 };
  /** Offset de "estacionada" al que se dirige mientras se acerca, y del que
   * se aleja al irse — misma dirección en la que apareció. */
  private dockOffset = { x: 0, y: 0 };

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

    this.offset = this.pickSpawnOffset();
    const mag = Math.max(1, Math.hypot(this.offset.x, this.offset.y));
    this.dockOffset = { x: (this.offset.x / mag) * PARK_DISTANCE, y: (this.offset.y / mag) * PARK_DISTANCE };

    this.towShip = new TowShip(this.scene, this.ship.x + this.offset.x, this.ship.y + this.offset.y);
    this.worldLayer.add(this.towShip);
    this.faceTravelDirection(this.dockOffset.x - this.offset.x, this.dockOffset.y - this.offset.y);

    this.state = "approaching";
    return true;
  }

  /** Offset de aparición fuera de la vista actual de la cámara, en un lado
   * al azar. */
  private pickSpawnOffset() {
    const cam = this.scene.cameras.main;
    const halfW = cam.width / 2 / cam.zoom + OFFSCREEN_MARGIN;
    const halfH = cam.height / 2 / cam.zoom + OFFSCREEN_MARGIN;

    const side = Phaser.Math.Between(0, 3); // 0:izq 1:der 2:arriba 3:abajo
    const along = Phaser.Math.FloatBetween(-0.6, 0.6); // variación a lo largo del borde
    switch (side) {
      case 0:
        return { x: -halfW, y: along * halfH };
      case 1:
        return { x: halfW, y: along * halfH };
      case 2:
        return { x: along * halfW, y: -halfH };
      default:
        return { x: along * halfW, y: halfH };
    }
  }

  private faceTravelDirection(dx: number, dy: number) {
    this.towShip?.faceDirection(dx, dy);
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

    // updateLeaving puede haber destruido la nave en este mismo frame
    // (al salir de la vista) — si es así, no hay nada más que reposicionar.
    if (!this.towShip) return;

    // Posición mundial = SIEMPRE nave.posición + offset relativo. Esto es
    // lo que hace que la grúa nunca se "pierda": hereda la deriva de la
    // nave automáticamente, cualquiera sea su velocidad.
    this.towShip.x = this.ship.x + this.offset.x;
    this.towShip.y = this.ship.y + this.offset.y;
  }

  private updateApproaching(dt: number) {
    const dx = this.dockOffset.x - this.offset.x;
    const dy = this.dockOffset.y - this.offset.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 2) {
      this.offset = { ...this.dockOffset };
      this.state = "refueling";
      return;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;
    this.faceTravelDirection(dirX, dirY);

    const step = APPROACH_SPEED * dt;
    if (step >= dist) {
      this.offset = { ...this.dockOffset };
      this.state = "refueling";
    } else {
      this.offset = { x: this.offset.x + dirX * step, y: this.offset.y + dirY * step };
    }
  }

  private updateRefueling(dt: number) {
    // El offset queda fijo en dockOffset: al calcularse la posición mundial
    // como ship.pos + offset, se mantiene "pegada" a la nave del jugador
    // aunque esta derive por la gravedad sin poder frenar.
    this.inventory.refuel(REFUEL_RATE * dt);

    if (this.inventory.fuel >= this.inventory.fuelCapacity) {
      // Se va por donde vino: aleja el offset en la misma dirección.
      const mag = Math.max(1, Math.hypot(this.offset.x, this.offset.y));
      this.faceTravelDirection(this.offset.x / mag, this.offset.y / mag);
      this.state = "leaving";
    }
  }

  private updateLeaving(dt: number) {
    const mag = Math.max(1, Math.hypot(this.offset.x, this.offset.y));
    const dirX = this.offset.x / mag;
    const dirY = this.offset.y / mag;
    this.offset = { x: this.offset.x + dirX * LEAVE_SPEED * dt, y: this.offset.y + dirY * LEAVE_SPEED * dt };

    const cam = this.scene.cameras.main;
    const halfW = cam.width / 2 / cam.zoom + OFFSCREEN_MARGIN;
    const halfH = cam.height / 2 / cam.zoom + OFFSCREEN_MARGIN;
    if (Math.abs(this.offset.x) > halfW || Math.abs(this.offset.y) > halfH) {
      this.towShip!.destroy();
      this.towShip = null;
      this.state = "idle";
    }
  }
}
