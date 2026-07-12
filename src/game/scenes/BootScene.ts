import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    // Aquí se cargarán spritesheets/atlas cuando existan assets propios.
    // Por ahora el juego usa gráficos vectoriales (Phaser.GameObjects.Arc/Triangle)
    // para no depender de arte antes de validar mecánicas.
  }

  create() {
    this.scene.start("main");
  }
}
