import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";
import type { ResourceType } from "./Asteroid";

export const PICKUP_RADIUS = 11;
/** Tiempo antes de que un mineral no recogido se disipe, para no acumular
 * objetos sin límite en sectores donde el jugador ya no vuelve. */
const PICKUP_LIFESPAN = 45;
/** Fricción del mineral flotante: fracción de velocidad que conserva
 * después de 1 segundo (decaimiento exponencial). Sin esto no hay ninguna
 * fricción y los minerales heredan la velocidad de lanzamiento para
 * siempre, terminando esparcidos lejos entre sí con el tiempo — con este
 * frenado se detienen rápido y quedan agrupados cerca de donde explotó
 * el asteroide. */
const PICKUP_DRAG = 0.12;

const ORE_ICON_KEYS: Record<ResourceType, string> = {
  iron: "ore-iron",
  ice: "ore-ice",
  rareMineral: "ore-rareMineral",
};

/**
 * Mineral flotante que queda al destruir un asteroide a tiros. Es un
 * LightBody: la gravedad de estrellas/planetas cercanos lo afecta igual
 * que a un asteroide, así que no quedan "clavados" de forma antinatural.
 * La nave lo recoge automáticamente al pasar por encima (sin botón).
 */
export class ResourcePickup extends Phaser.GameObjects.Image implements LightBody {
  vx: number;
  vy: number;
  resourceType: ResourceType;
  amount: number;
  private timeToLive = PICKUP_LIFESPAN;
  private spinSpeed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resourceType: ResourceType,
    amount: number,
    vx: number,
    vy: number
  ) {
    super(scene, x, y, ORE_ICON_KEYS[resourceType]);
    this.resourceType = resourceType;
    this.amount = amount;
    this.vx = vx;
    this.vy = vy;
    this.setDisplaySize(PICKUP_RADIUS * 2, PICKUP_RADIUS * 2);
    this.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    this.spinSpeed = Phaser.Math.FloatBetween(-1.2, 1.2);
    scene.add.existing(this);
  }

  /** Devuelve false cuando expiró (para que el caller lo destruya) */
  applyVelocity(dt: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const dragFactor = Math.pow(PICKUP_DRAG, dt);
    this.vx *= dragFactor;
    this.vy *= dragFactor;

    this.rotation += this.spinSpeed * dt;
    this.timeToLive -= dt;
    return this.timeToLive > 0;
  }
}
