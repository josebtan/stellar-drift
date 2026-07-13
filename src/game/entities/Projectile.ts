import Phaser from "phaser";

export const PROJECTILE_SPEED = 900;
export const PROJECTILE_LIFESPAN = 1.4; // segundos
export const PROJECTILE_DAMAGE = 12;
export const PROJECTILE_RADIUS = 4;

/**
 * Proyectil disparado por la nave. Viaja en línea recta (no se ve afectado
 * por la gravedad — hacerlo realista complicaría mucho apuntar, y no aporta
 * al gameplay). Vive un tiempo limitado y se destruye solo al expirar o al
 * impactar algo.
 */
export class Projectile extends Phaser.GameObjects.Arc {
  vx: number;
  vy: number;
  private lifespan = PROJECTILE_LIFESPAN;

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number) {
    // `angle` sigue la convención de rotation de PlayerShip (0 = arriba)
    super(scene, x, y, PROJECTILE_RADIUS, 0, 360, false, 0x8ce3ff, 1);
    const travelAngle = angle - Math.PI / 2; // convertir a convención atan2 (0 = derecha)
    this.vx = Math.cos(travelAngle) * PROJECTILE_SPEED;
    this.vy = Math.sin(travelAngle) * PROJECTILE_SPEED;
    this.setStrokeStyle(1, 0xffffff, 0.6);
    scene.add.existing(this);
  }

  /** Devuelve false cuando el proyectil expiró (para que el caller lo destruya) */
  update(dt: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifespan -= dt;
    return this.lifespan > 0;
  }
}
