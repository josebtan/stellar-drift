import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";

export type ResourceType = "iron" | "ice" | "rareMineral";

export interface AsteroidConfig {
  x: number;
  y: number;
  radius: number;
  resourceType: ResourceType;
  amount: number;
  vx?: number;
  vy?: number;
}

const RESOURCE_COLORS: Record<ResourceType, number> = {
  iron: 0x9a8c78,
  ice: 0xbfe8ff,
  rareMineral: 0xd6a4ff,
};

/**
 * Asteroide minable. Es un LightBody: se ve afectado por la
 * gravedad de estrellas/planetas igual que la nave del jugador.
 */
export class Asteroid extends Phaser.GameObjects.Arc implements LightBody {
  vx: number;
  vy: number;
  resourceType: ResourceType;
  amountRemaining: number;

  constructor(scene: Phaser.Scene, config: AsteroidConfig) {
    super(
      scene,
      config.x,
      config.y,
      config.radius,
      0,
      360,
      false,
      RESOURCE_COLORS[config.resourceType]
    );
    this.vx = config.vx ?? 0;
    this.vy = config.vy ?? 0;
    this.resourceType = config.resourceType;
    this.amountRemaining = config.amount;
    this.setStrokeStyle(1, 0xffffff, 0.25);
    scene.add.existing(this);
  }

  applyVelocity(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** Extrae una cantidad de recurso; devuelve lo realmente extraído. */
  mine(amount: number): number {
    const extracted = Math.min(amount, this.amountRemaining);
    this.amountRemaining -= extracted;
    if (this.amountRemaining <= 0) {
      this.destroy();
    }
    return extracted;
  }
}
