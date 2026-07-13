import Phaser from "phaser";

/**
 * Estación espacial. Por ahora es decorativa/visual (referencia clara del
 * "punto de venta" que se planea para el sistema de comercio) — no tiene
 * gravedad ni colisión todavía; eso se añadirá junto con la mecánica de
 * comercio.
 */
export class SpaceStation extends Phaser.GameObjects.Sprite {
  radius: number;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number) {
    super(scene, x, y, "station-orion");
    this.radius = radius;
    // El sprite ya viene recortado a su contenido real (sin glow/padding
    // extra), así que escalar por ancho nativo alcanza para que el diámetro
    // visible coincida con `radius`.
    const scale = (radius * 2) / this.width;
    this.setScale(scale);
    scene.add.existing(this);
  }
}
