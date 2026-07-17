import Phaser from "phaser";

/** Alto deseado en pantalla (unidades de mundo) — un poco más grande que la
 * nave del jugador, para que se note que es una nave de servicio robusta. */
const TOW_SHIP_DISPLAY_HEIGHT = 60;

/**
 * Nave de servicio (grúa espacial) contratada desde el botón de emergencia.
 * No tiene física propia (ni gravedad ni colisiones): solo se desplaza en
 * línea recta según la dirección que le indica TowShipService.
 */
export class TowShip extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tow-ship");
    const scale = TOW_SHIP_DISPLAY_HEIGHT / this.height;
    this.setScale(scale);
    this.setDepth(5); // por debajo del HUD, por encima de fondo/asteroides
    scene.add.existing(this);
  }

  /** Orienta la nave hacia la dirección en la que se mueve (convención
   * rotation=0=arriba, igual que PlayerShip). */
  faceDirection(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
  }
}
