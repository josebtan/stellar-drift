import Phaser from "phaser";

export type CelestialType = "star" | "planet";

export interface CelestialBodyConfig {
  type: CelestialType;
  x: number;
  y: number;
  radius: number;
  mass: number;
  color: number;
  influenceRadius: number;
  /** Si orbita otro cuerpo (ej. planeta alrededor de una estrella) */
  orbitCenter?: { x: number; y: number };
  orbitDistance?: number;
  orbitSpeed?: number; // radianes / segundo
}

/**
 * Cuerpo celeste masivo (estrella o planeta). Puede tener una órbita
 * kepleriana simple alrededor de un centro (otra estrella).
 */
export class CelestialBody extends Phaser.GameObjects.Container {
  public readonly config: CelestialBodyConfig;
  private orbitAngle = 0;
  private sprite: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, config: CelestialBodyConfig) {
    super(scene, config.x, config.y);
    this.config = config;

    this.sprite = scene.add.circle(0, 0, config.radius, config.color);
    this.add(this.sprite);

    if (config.type === "star") {
      const glow = scene.add.circle(0, 0, config.radius * 1.6, config.color, 0.15);
      this.addAt(glow, 0);
    }

    scene.add.existing(this);

    if (config.orbitCenter && config.orbitDistance) {
      this.orbitAngle = Phaser.Math.Angle.Between(
        config.orbitCenter.x,
        config.orbitCenter.y,
        config.x,
        config.y
      );
    }
  }

  update(dt: number) {
    const { orbitCenter, orbitDistance, orbitSpeed } = this.config;
    if (orbitCenter && orbitDistance && orbitSpeed) {
      this.orbitAngle += orbitSpeed * dt;
      this.x = orbitCenter.x + Math.cos(this.orbitAngle) * orbitDistance;
      this.y = orbitCenter.y + Math.sin(this.orbitAngle) * orbitDistance;
      this.config.x = this.x;
      this.config.y = this.y;
    }
  }
}
