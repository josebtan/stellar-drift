import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";
import type { ResourceType } from "./Asteroid";

export const PICKUP_RADIUS = 7;
/** Tiempo antes de que un mineral no recogido se disipe, para no acumular
 * objetos sin límite en sectores donde el jugador ya no vuelve. */
const PICKUP_LIFESPAN = 45;

const RESOURCE_COLORS: Record<ResourceType, number> = {
  iron: 0xb3a48c,
  ice: 0x9fd9ff,
  rareMineral: 0xcf9dff,
};

/**
 * Mineral flotante que queda al destruir un asteroide a tiros. Es un
 * LightBody: la gravedad de estrellas/planetas cercanos lo afecta igual
 * que a un asteroide, así que no quedan "clavados" de forma antinatural.
 * La nave lo recoge automáticamente al pasar por encima (sin botón).
 */
export class ResourcePickup extends Phaser.GameObjects.Arc implements LightBody {
  vx: number;
  vy: number;
  resourceType: ResourceType;
  amount: number;
  private timeToLive = PICKUP_LIFESPAN;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resourceType: ResourceType,
    amount: number,
    vx: number,
    vy: number
  ) {
    super(scene, x, y, PICKUP_RADIUS, 0, 360, false, RESOURCE_COLORS[resourceType], 1);
    this.resourceType = resourceType;
    this.amount = amount;
    this.vx = vx;
    this.vy = vy;
    this.setStrokeStyle(1, 0xffffff, 0.5);
    scene.add.existing(this);
  }

  /** Devuelve false cuando expiró (para que el caller lo destruya) */
  applyVelocity(dt: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.timeToLive -= dt;
    return this.timeToLive > 0;
  }
}
