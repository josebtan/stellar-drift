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

const HEALTH_PER_RADIUS = 2; // a mayor tamaño, más disparos hacen falta

/**
 * Asteroide destructible a tiros. Es un LightBody: se ve afectado por la
 * gravedad de estrellas/planetas igual que la nave del jugador.
 *
 * Tiene dos "vidas" separadas:
 * - `health`: integridad estructural, baja con cada disparo. Al llegar a 0
 *   se destruye (ver takeDamage).
 * - `resourceAmount`: el mineral que suelta como pickups flotantes al
 *   destruirse (no se gasta con los disparos, es el "premio" final).
 */
export class Asteroid extends Phaser.GameObjects.Sprite implements LightBody {
  vx: number;
  vy: number;
  resourceType: ResourceType;
  resourceAmount: number;
  /** Radio "físico" (no visual) usado por gravedad y colisiones */
  radius: number;
  health: number;
  maxHealth: number;

  constructor(scene: Phaser.Scene, config: AsteroidConfig) {
    const modelIndex = config.modelIndex ?? Phaser.Math.Between(0, ASTEROID_MODEL_COUNT - 1);
    super(scene, config.x, config.y, "asteroid", modelIndex);
    this.vx = config.vx ?? 0;
    this.vy = config.vy ?? 0;
    this.resourceType = config.resourceType;
    this.resourceAmount = config.amount;
    this.radius = config.radius;
    this.maxHealth = Math.max(8, config.radius * HEALTH_PER_RADIUS);
    this.health = this.maxHealth;

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

  /** Aplica daño de un impacto. Devuelve true si el asteroide se destruyó. */
  takeDamage(amount: number): boolean {
    this.health -= amount;
    // Parpadeo simple al recibir el impacto
    this.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.setTint(RESOURCE_TINTS[this.resourceType]);
    });
    if (this.health <= 0) {
      this.destroy();
      return true;
    }
    return false;
  }
}
