import Phaser from "phaser";
import { getUiScale } from "../uiScale";

const BASE_RADIUS = 18;
const BASE_MARGIN = 14;
const BASE_FONT_SIZE = 18;

/**
 * Botón circular (arriba a la izquierda) para entrar/salir de pantalla
 * completa real usando el Fullscreen API del navegador — esto es lo que
 * de verdad oculta la barra de direcciones y demás UI del navegador en
 * celular, más allá de que el canvas ya ocupe todo el viewport.
 *
 * Si el navegador no soporta el Fullscreen API (algunos WebViews) no se
 * crea nada, así que no hay que revisar disponibilidad desde afuera.
 */
export class FullscreenToggle {
  private scene: Phaser.Scene;
  private bg?: Phaser.GameObjects.Arc;
  private icon?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, uiLayer?: Phaser.GameObjects.Layer) {
    this.scene = scene;
    if (!scene.scale.fullscreen.available) return;

    this.bg = scene.add
      .circle(0, 0, BASE_RADIUS, 0x0a0f16, 0.55)
      .setStrokeStyle(1.5, 0x8ce3ff, 0.55)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toggle());
    uiLayer?.add(this.bg);

    this.icon = scene.add
      .text(0, 0, "⛶", { fontFamily: "Arial, sans-serif", color: "#cfe8ff" })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(201);
    uiLayer?.add(this.icon);

    scene.scale.on("resize", () => this.reposition());
    scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => this.icon?.setText("⤡"));
    scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => this.icon?.setText("⛶"));
    this.reposition();
  }

  private toggle() {
    if (this.scene.scale.isFullscreen) this.scene.scale.stopFullscreen();
    else this.scene.scale.startFullscreen();
  }

  private reposition() {
    if (!this.bg || !this.icon) return;
    const scale = getUiScale(this.scene);
    // El área segura (notch, etc.) ya la respeta el padding CSS de #app en
    // index.html, así que el canvas arranca después de eso: acá solo hace
    // falta el margen normal del HUD.
    const margin = BASE_MARGIN * scale;
    const radius = BASE_RADIUS * scale;
    const cx = margin + radius;
    const cy = margin + radius;
    this.bg.setRadius(radius).setPosition(cx, cy);
    this.icon.setFontSize(Math.round(BASE_FONT_SIZE * scale)).setPosition(cx, cy);
  }
}
