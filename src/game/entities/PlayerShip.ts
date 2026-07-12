import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";

const THRUST_ACCEL = 220; // px/s^2
const ROTATION_SPEED = 3.2; // rad/s
const MAX_SPEED = 600;
const MAX_HULL = 100;
/** Segundos de invulnerabilidad tras recibir daño o respawnear, para no
 * recibir varios golpes seguidos por seguir superpuesto con lo que chocó. */
const INVULNERABILITY_SECONDS = 1.5;

/**
 * Nave controlada por el jugador. Implementa LightBody para que
 * GravitySystem pueda afectarla igual que a un asteroide.
 */
export class PlayerShip extends Phaser.GameObjects.Triangle implements LightBody {
  /** Radio de colisión aproximado (la nave es un triángulo ~28x34) */
  static readonly COLLISION_RADIUS = 15;

  vx = 0;
  vy = 0;
  hull = MAX_HULL;
  isDestroyed = false;
  private invulnerableSeconds = 0;

  private keys: {
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private thrusting = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Triángulo apuntando "hacia arriba" (punta en -Y)
    super(scene, x, y, 0, -18, -14, 14, 14, 14, 0x123047, 1);
    this.setStrokeStyle(2, 0x8ce3ff);

    scene.add.existing(this);

    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  get isThrusting() {
    return this.thrusting;
  }

  get isInvulnerable() {
    return this.invulnerableSeconds > 0;
  }

  /** Aplica input del jugador (rotación + empuje). La gravedad se aplica aparte. */
  handleInput(dt: number) {
    if (this.isDestroyed) return;

    const kb = this.scene.input.keyboard!;
    const left = this.keys.left.isDown || kb.addKey("A").isDown;
    const right = this.keys.right.isDown || kb.addKey("D").isDown;
    const up = this.keys.up.isDown || kb.addKey("W").isDown;

    if (left) this.rotation -= ROTATION_SPEED * dt;
    if (right) this.rotation += ROTATION_SPEED * dt;

    this.thrusting = up;
    if (up) {
      // rotation=0 apunta "arriba" (-Y) según los puntos del triángulo
      const angle = this.rotation - Math.PI / 2;
      this.vx += Math.cos(angle) * THRUST_ACCEL * dt;
      this.vy += Math.sin(angle) * THRUST_ACCEL * dt;
    }

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      this.vx *= scale;
      this.vy *= scale;
    }
  }

  /** Integra movimiento (llamado tras aplicar gravedad en GravitySystem.step) */
  applyVelocity(dt: number) {
    if (this.isDestroyed) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** Debe llamarse una vez por frame para bajar el contador de invulnerabilidad. */
  tickInvulnerability(dt: number) {
    if (this.invulnerableSeconds > 0) {
      this.invulnerableSeconds = Math.max(0, this.invulnerableSeconds - dt);
      // Parpadeo visual simple mientras dura la invulnerabilidad
      this.setAlpha(Math.floor(this.invulnerableSeconds * 10) % 2 === 0 ? 0.35 : 1);
    } else if (this.alpha !== 1) {
      this.setAlpha(1);
    }
  }

  /** Daño por impacto (ej. choque con asteroide). No aplica si está invulnerable. */
  takeDamage(amount: number): boolean {
    if (this.isDestroyed || this.isInvulnerable) return false;
    this.hull = Math.max(0, this.hull - amount);
    this.invulnerableSeconds = INVULNERABILITY_SECONDS;
    if (this.hull <= 0) {
      this.destroyShip();
    }
    return true;
  }

  /** Destrucción total (ej. impacto contra estrella/planeta, o casco a 0) */
  destroyShip() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.hull = 0;
    this.vx = 0;
    this.vy = 0;
    this.setVisible(false);
  }

  /** Reinicia la nave en una posición segura tras la pantalla de "nave destruida". */
  respawn(x: number, y: number) {
    this.isDestroyed = false;
    this.hull = MAX_HULL;
    this.vx = 0;
    this.vy = 0;
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.invulnerableSeconds = INVULNERABILITY_SECONDS;
    this.setVisible(true);
    this.setAlpha(1);
  }
}
