import Phaser from "phaser";

export const PROJECTILE_SPEED = 900;
// Tiempo de vida "de seguridad": el despawn normal ahora es por salir de
// la vista de la cámara (ver CombatSystem.updateProjectiles), esto es
// solo un tope por si un proyectil quedara siempre en pantalla (ej.
// disparado en la misma dirección y velocidad que la nave lo persigue).
export const PROJECTILE_LIFESPAN = 4;
export const PROJECTILE_DAMAGE = 12;
export const PROJECTILE_RADIUS = 4;

/**
 * Proyectil disparado por la nave. Viaja en línea recta (no se ve afectado
 * por la gravedad — hacerlo realista complicaría mucho apuntar, y no aporta
 * al gameplay). Vive hasta impactar algo o salir de la vista de la cámara
 * (con un tope de tiempo de seguridad).
 */
export class Projectile extends Phaser.GameObjects.Arc {
  vx: number;
  vy: number;
  private lifespan = PROJECTILE_LIFESPAN;

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, shipVx: number, shipVy: number) {
    // `angle` sigue la convención de rotation de PlayerShip (0 = arriba)
    super(scene, x, y, PROJECTILE_RADIUS, 0, 360, false, 0x8ce3ff, 1);
    const travelAngle = angle - Math.PI / 2; // convertir a convención atan2 (0 = derecha)
    // Hereda la velocidad de la nave al momento de disparar (como el
    // proyectil real de un arma en una plataforma en movimiento): así su
    // velocidad relativa a la nave es SIEMPRE PROJECTILE_SPEED hacia
    // adelante, sin importar qué tan rápido vaya la nave — nunca se ve
    // "yendo hacia atrás" en pantalla (la cámara sigue a la nave 1:1).
    this.vx = Math.cos(travelAngle) * PROJECTILE_SPEED + shipVx;
    this.vy = Math.sin(travelAngle) * PROJECTILE_SPEED + shipVy;
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
