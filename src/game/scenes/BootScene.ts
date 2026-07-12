import Phaser from "phaser";
import sunSpritesheet from "../../assets/celestial/sun-spritesheet.png";

const SUN_FRAME_SIZE = 330;
const SUN_FRAME_COUNT = 15;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.spritesheet("sun", sunSpritesheet, {
      frameWidth: SUN_FRAME_SIZE,
      frameHeight: SUN_FRAME_SIZE,
    });
  }

  create() {
    this.anims.create({
      key: "sun-glow",
      frames: this.anims.generateFrameNumbers("sun", { start: 0, end: SUN_FRAME_COUNT - 1 }),
      frameRate: 12,
      repeat: -1,
    });

    this.scene.start("main");
  }
}
