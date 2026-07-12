import Phaser from "phaser";
import type { LightBody } from "../physics/GravitySystem";

const THRUST_ACCEL = 220; // px/s^2
const ROTATION_SPEED = 3.2; // rad/s
const MAX_SPEED = 600;

/**
 * Nave controlada por el jugador. Implementa LightBody para que
 * GravitySystem pueda afectarla igual que a un asteroide.
 */
export class PlayerShip extends Phaser.GameObjects.Triangle implements LightBody {
  vx = 0;
  vy = 0;

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

  /** Aplica input del jugador (rotación + empuje). La gravedad se aplica aparte. */
  handleInput(dt: number) {
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
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
