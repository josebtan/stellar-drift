import Phaser from "phaser";
import { getPlanetSprite } from "../planetCatalog";
import { SUN_DISC_FRACTION } from "../assetConstants";

export type CelestialType = "star" | "planet";

export interface CelestialBodyConfig {
  type: CelestialType;
  x: number;
  y: number;
  radius: number;
  mass: number;
  color: number;
  influenceRadius: number;
  /** Clave del sprite en el catálogo (obligatorio para type:"planet") */
  spriteKey?: string;
  /** Si orbita otro cuerpo (ej. planeta alrededor de una estrella) */
  orbitCenter?: { x: number; y: number };
  orbitDistance?: number;
  orbitSpeed?: number; // radianes / segundo
}

/**
 * Cuerpo celeste masivo (estrella o planeta). Puede tener una órbita
 * kepleriana simple alrededor de un centro (otra estrella).
 */
export class CelestialBody extends Phaser.GameObjects.Container {
  public readonly config: CelestialBodyConfig;
  private orbitAngle = 0;

  // Segunda capa del sol, desfasada en el tiempo respecto a la base, para
  // que la iluminación INTERNA (no solo el halo) varíe con la animación:
  // al reproducirse a otro frame rate y arrancar en otro frame, sus zonas
  // brillantes (fusionadas en modo ADD) nunca coinciden con las de la capa
  // base, dando la sensación de manchas de calor que se mueven por dentro.
  private glowOverlay?: Phaser.GameObjects.Sprite;
  private pulseTime = 0;
  private pulseSpeed = 1;

  constructor(scene: Phaser.Scene, config: CelestialBodyConfig) {
    super(scene, config.x, config.y);
    this.config = config;

    if (config.type === "star") {
      const sprite = scene.add.sprite(0, 0, "sun");
      // El frame no es cuadrado (las llamaradas laterales lo hacen más ancho
      // que alto), así que escalamos por ALTURA — el disco real ocupa
      // SUN_DISC_FRACTION de la altura del frame, medido de antemano.
      const scale = (config.radius * 2) / (sprite.height * SUN_DISC_FRACTION);
      sprite.setScale(scale);
      sprite.play("sun-glow");
      this.add(sprite);

      const overlay = scene.add.sprite(0, 0, "sun");
      overlay.setScale(scale);
      overlay.setBlendMode(Phaser.BlendModes.ADD);
      overlay.setTint(0xfff2c8);
      overlay.play({
        key: "sun-glow",
        frameRate: 8.5, // distinto del de la capa base (12): el desfase entre ambas nunca se repite igual
        startFrame: Phaser.Math.Between(0, 14),
      });
      this.add(overlay);
      this.glowOverlay = overlay;
      this.pulseTime = Phaser.Math.FloatBetween(0, 100);
      this.pulseSpeed = Phaser.Math.FloatBetween(0.6, 1.3);
    } else if (config.spriteKey) {
      const sprite = scene.add.sprite(0, 0, config.spriteKey);
      const { discFraction } = getPlanetSprite(config.spriteKey);
      // sprite.width es el ancho nativo de la textura (sin escalar), así que
      // esto da el factor exacto para que el DISCO (no el glow/anillo) mida
      // config.radius*2 en pantalla, sin importar la resolución del sprite.
      const scale = (config.radius * 2) / (sprite.width * discFraction);
      sprite.setScale(scale);
      this.add(sprite);
    } else {
      const sprite = scene.add.circle(0, 0, config.radius, config.color);
      this.add(sprite);
    }

    scene.add.existing(this);

    if (config.orbitCenter && config.orbitDistance) {
      this.orbitAngle = Phaser.Math.Angle.Between(
        config.orbitCenter.x,
        config.orbitCenter.y,
        config.x,
        config.y
      );
    }
  }

  update(dt: number) {
    const { orbitCenter, orbitDistance, orbitSpeed } = this.config;
    if (orbitCenter && orbitDistance && orbitSpeed) {
      this.orbitAngle += orbitSpeed * dt;
      this.x = orbitCenter.x + Math.cos(this.orbitAngle) * orbitDistance;
      this.y = orbitCenter.y + Math.sin(this.orbitAngle) * orbitDistance;
      this.config.x = this.x;
      this.config.y = this.y;
    }

    if (this.glowOverlay) {
      this.pulseTime += dt * this.pulseSpeed;
      // "Respira" entre ~0.15 y ~0.42 de opacidad — junto al desfase de
      // frames de la capa base, da la sensación de manchas de calor que
      // se encienden y apagan por dentro del sol, no solo en el halo.
      this.glowOverlay.setAlpha(0.15 + 0.27 * (0.5 + 0.5 * Math.sin(this.pulseTime)));
    }
  }
}
