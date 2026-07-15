import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";

const THRUST_ACCEL = 260; // px/s^2
const TURN_SPEED = 6; // rad/s — qué tan rápido gira para encarar el cursor/joystick
const MAX_SPEED = 600;
const MAX_HULL = 100;
/** Segundos de invulnerabilidad tras recibir daño o respawnear, para no
 * recibir varios golpes seguidos por seguir superpuesto con lo que chocó. */
const INVULNERABILITY_SECONDS = 1.5;
/** Alto deseado de la nave en pantalla (unidades de mundo) */
const SHIP_DISPLAY_HEIGHT = 46;
/** El efecto de escudo se ve mejor un poco más grande que la nave */
const SHIELD_EFFECT_SIZE = SHIP_DISPLAY_HEIGHT * 1.8;

/**
 * Nave controlada por el jugador. Implementa LightBody para que
 * GravitySystem pueda afectarla igual que a un asteroide.
 *
 * Esquema de control: la rotación apunta hacia el cursor/joystick de
 * apuntado (independiente del movimiento), y la traslación es en
 * direcciones absolutas de mundo (arriba/abajo/izquierda/derecha), no
 * relativa a hacia dónde mira la nave — típico de un twin-stick shooter.
 */
export class PlayerShip extends Phaser.GameObjects.Sprite implements LightBody {
  /** Radio de colisión aproximado, ajustado al tamaño real del sprite */
  static readonly COLLISION_RADIUS = 20;

  vx = 0;
  vy = 0;
  hull = MAX_HULL;
  isDestroyed = false;
  private invulnerableSeconds = 0;
  private thrusting = false;

  /** Destello de escudo (spritesheet provisto): se reproduce al recibir
   * daño o al respawnear, dando feedback visual de "invulnerabilidad
   * activa" más claro que solo el parpadeo de alpha. */
  readonly shieldEffect: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // El sprite ya viene orientado "hacia arriba" (cabina/motores arriba,
    // brazos abajo), igual que la convención rotation=0=arriba que usa el
    // resto del código — no hace falta rotar la textura base.
    super(scene, x, y, "ship-miner");
    const scale = SHIP_DISPLAY_HEIGHT / this.height;
    this.setScale(scale);
    scene.add.existing(this);

    this.shieldEffect = scene.add
      .sprite(x, y, "shield-burst")
      .setDisplaySize(SHIELD_EFFECT_SIZE, SHIELD_EFFECT_SIZE)
      .setVisible(false)
      .setDepth(this.depth + 1);
    this.shieldEffect.on("animationcomplete", () => this.shieldEffect.setVisible(false));
  }

  get isThrusting() {
    return this.thrusting;
  }

  get isInvulnerable() {
    return this.invulnerableSeconds > 0;
  }

  /**
   * Aplica el input ya resuelto por InputController: `moveVector` es la
   * dirección de traslación deseada (mundo absoluto, cada eje en [-1,1],
   * ya normalizado), y `aimAngle` es hacia dónde debe girar la nave
   * (ángulo en pantalla, donde 0 = arriba, coincide con la convención de
   * `rotation` de este sprite). La gravedad se aplica aparte.
   */
  handleInput(
    dt: number,
    moveVector: { x: number; y: number },
    aimAngle: number | null,
    hasFuel: boolean
  ) {
    if (this.isDestroyed) return;

    if (aimAngle !== null) {
      // El ángulo de Phaser.Math.Angle mide 0=derecha, pero nuestra nave
      // apunta "arriba" en rotation=0, así que sumamos 90°.
      const target = aimAngle + Math.PI / 2;
      this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, target, TURN_SPEED * dt);
    }

    const wantsThrust = moveVector.x !== 0 || moveVector.y !== 0;
    this.thrusting = wantsThrust && hasFuel;
    if (this.thrusting) {
      this.vx += moveVector.x * THRUST_ACCEL * dt;
      this.vy += moveVector.y * THRUST_ACCEL * dt;
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

    if (this.shieldEffect.visible) {
      this.shieldEffect.setPosition(this.x, this.y);
    }
  }

  private playShieldEffect() {
    this.shieldEffect.setPosition(this.x, this.y);
    this.shieldEffect.setVisible(true);
    this.shieldEffect.play("shield-burst-anim");
  }

  /** Daño por impacto (ej. choque con asteroide). No aplica si está invulnerable. */
  takeDamage(amount: number): boolean {
    if (this.isDestroyed || this.isInvulnerable) return false;
    this.hull = Math.max(0, this.hull - amount);
    this.invulnerableSeconds = INVULNERABILITY_SECONDS;
    this.playShieldEffect();
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
    this.shieldEffect.setVisible(false);
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
    this.playShieldEffect();
  }
}
