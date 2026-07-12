import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";
import { ASTEROID_MODEL_DISC_FRACTIONS, ASTEROID_MODEL_COUNT } from "../assetConstants";

export type ResourceType = "iron" | "ice" | "rareMineral";

export interface AsteroidConfig {
  x: number;
  y: number;
  radius: number;
  resourceType: ResourceType;
  amount: number;
  /** Qué modelo (de los 9 provistos) usar. Si no se especifica, se elige
   * uno al azar localmente (útil para código que no viene del generador
   * procedural determinista). */
  modelIndex?: number;
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
    const modelIndex = config.modelIndex ?? Phaser.Math.Between(0, ASTEROID_MODEL_COUNT - 1);
    super(scene, config.x, config.y, "asteroid", modelIndex);
    this.vx = config.vx ?? 0;
    this.vy = config.vy ?? 0;
    this.resourceType = config.resourceType;
    this.amountRemaining = config.amount;

    const discFraction = ASTEROID_MODEL_DISC_FRACTIONS[modelIndex];
    const scale = (config.radius * 2) / (this.width * discFraction);
    this.setScale(scale);
    this.setTint(RESOURCE_TINTS[config.resourceType]);
    // Rotación 2D fija y aleatoria: cada modelo ya es una forma irregular
    // distinta, así que basta con orientarlo distinto para que no se vean
    // todos los asteroides "parados" igual.
    this.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

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
