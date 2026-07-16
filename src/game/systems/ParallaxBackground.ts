import Phaser from "phaser";

interface LayerConfig {
  key: string;
  tileSize: number;
  starCount: number;
  minRadius: number;
  maxRadius: number;
  minAlpha: number;
  maxAlpha: number;
  /** Qué tan rápido se desplaza el patrón respecto a la cámara (0=fijo, 1=igual que el mundo) */
  parallaxFactor: number;
  depth: number;
}

const LAYERS: LayerConfig[] = [
  // Capa lejana: puntos chicos y tenues, apenas se mueven (sensación de muy lejos)
  { key: "starfield-far", tileSize: 640, starCount: 90, minRadius: 0.4, maxRadius: 1.0, minAlpha: 0.15, maxAlpha: 0.45, parallaxFactor: 0.04, depth: -30 },
  // Capa media
  { key: "starfield-mid", tileSize: 560, starCount: 110, minRadius: 0.6, maxRadius: 1.4, minAlpha: 0.3, maxAlpha: 0.8, parallaxFactor: 0.1, depth: -20 },
  // Capa cercana: puntos más grandes y brillantes, se mueven más (da profundidad)
  { key: "starfield-near", tileSize: 480, starCount: 70, minRadius: 1.0, maxRadius: 2.0, minAlpha: 0.5, maxAlpha: 1, parallaxFactor: 0.2, depth: -10 },
];

/**
 * Fondo de estrellas con paralaje real de 3 capas. A diferencia de un HUD,
 * esto SÍ es parte del mundo del juego (cámara principal, con zoom): vive
 * en `worldLayer` con profundidad muy negativa, así queda siempre detrás
 * de la nave, los astros y los asteroides — nunca por encima.
 *
 * Cada capa es un TileSprite que se reposiciona cada frame para cubrir
 * siempre el viewport visible (usando camera.midPoint, que ya tiene en
 * cuenta scroll+zoom), mientras que el desplazamiento del patrón interno
 * (tilePosition) usa un factor de paralaje propio por capa — así las
 * capas más "lejanas" se sienten quietas y las más "cercanas" acompañan
 * más el movimiento de la cámara.
 */
export class ParallaxBackground {
  private scene: Phaser.Scene;
  private tiles: Phaser.GameObjects.TileSprite[] = [];

  constructor(scene: Phaser.Scene, worldLayer: Phaser.GameObjects.Layer) {
    this.scene = scene;

    for (const layer of LAYERS) {
      this.generateTileTexture(layer);
      const tile = scene.add
        .tileSprite(0, 0, 100, 100, layer.key)
        .setOrigin(0.5, 0.5)
        .setDepth(layer.depth)
        .setData("parallaxFactor", layer.parallaxFactor);
      worldLayer.add(tile);
      this.tiles.push(tile);
    }
  }

  private generateTileTexture(layer: LayerConfig) {
    if (this.scene.textures.exists(layer.key)) return;
    const gfx = this.scene.add.graphics();
    for (let i = 0; i < layer.starCount; i++) {
      const x = Phaser.Math.Between(0, layer.tileSize);
      const y = Phaser.Math.Between(0, layer.tileSize);
      const r = Phaser.Math.FloatBetween(layer.minRadius, layer.maxRadius);
      const alpha = Phaser.Math.FloatBetween(layer.minAlpha, layer.maxAlpha);
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(x, y, r);
    }
    gfx.generateTexture(layer.key, layer.tileSize, layer.tileSize);
    gfx.destroy();
  }

  /** Llamar una vez por frame. */
  update() {
    const cam = this.scene.cameras.main;
    const viewWidth = (cam.width / cam.zoom) * 1.15; // margen extra para evitar huecos en los bordes
    const viewHeight = (cam.height / cam.zoom) * 1.15;
    const center = cam.midPoint;

    for (const tile of this.tiles) {
      tile.setPosition(center.x, center.y);
      tile.setSize(viewWidth, viewHeight);
      const factor = tile.getData("parallaxFactor") as number;
      tile.tilePositionX = cam.scrollX * factor;
      tile.tilePositionY = cam.scrollY * factor;
    }
  }
}
