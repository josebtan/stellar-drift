import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";
import { ASTEROID_FRAME_COUNT, ASTEROID_DISC_FRACTION } from "../assetConstants";

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

// El sprite es grayscale a propósito: así el tinte reproduce el color del
// recurso con fidelidad (a diferencia de tintar una textura ya coloreada).
const RESOURCE_TINTS: Record<ResourceType, number> = {
  iron: 0xb3a48c,
  ice: 0x9fd9ff,
  rareMineral: 0xcf9dff,
};

/**
 * Asteroide minable. Es un LightBody: se ve afectado por la
 * gravedad de estrellas/planetas igual que la nave del jugador.
 */
export class Asteroid extends Phaser.GameObjects.Sprite implements LightBody {
  vx: number;
  vy: number;
  resourceType: ResourceType;
  amountRemaining: number;

  constructor(scene: Phaser.Scene, config: AsteroidConfig) {
    super(scene, config.x, config.y, "asteroid", 0);
    this.vx = config.vx ?? 0;
    this.vy = config.vy ?? 0;
    this.resourceType = config.resourceType;
    this.amountRemaining = config.amount;

    const scale = (config.radius * 2) / (this.width * ASTEROID_DISC_FRACTION);
    this.setScale(scale);
    this.setTint(RESOURCE_TINTS[config.resourceType]);

    scene.add.existing(this);

    // Cada asteroide gira a su propio ritmo (y a veces "al revés") usando
    // los 9 frames renderizados de la roca rotando, en vez de rotar el
    // sprite 2D (que se vería raro sobre una textura ya en perspectiva).
    this.play({ key: "asteroid-spin", startFrame: Phaser.Math.Between(0, ASTEROID_FRAME_COUNT - 1) });
    this.anims.timeScale = Phaser.Math.FloatBetween(-1.4, 1.4) || 0.6;
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
