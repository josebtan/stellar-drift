import Phaser from "phaser";
import type { Inventory } from "../systems/Inventory";
import type { PlayerShip } from "../entities/PlayerShip";
import type { ResourceType } from "../entities/Asteroid";
import {
  BAR_IMAGE_WIDTH,
  BAR_IMAGE_HEIGHT,
  BAR_HOLE_X,
  BAR_HOLE_Y,
  BAR_HOLE_WIDTH,
  BAR_HOLE_HEIGHT,
} from "../assetConstants";

const BAR_DISPLAY_WIDTH = 220;
const BAR_SCALE = BAR_DISPLAY_WIDTH / BAR_IMAGE_WIDTH;
const BAR_DISPLAY_HEIGHT = BAR_IMAGE_HEIGHT * BAR_SCALE;
const ROW_HEIGHT = BAR_DISPLAY_HEIGHT + 8;
const MARGIN = 16;

const ORE_ICON_KEYS: Record<ResourceType, string> = {
  iron: "ore-iron",
  ice: "ore-ice",
  rareMineral: "ore-rareMineral",
};

type PowerupState = "active" | "inUse" | "critical" | "disabled";
const POWERUP_STATE_COLORS: Record<PowerupState, number> = {
  active: 0x5ad16d,
  inUse: 0xff9c3d,
  critical: 0xff4d4d,
  disabled: 0x555555,
};

interface BarRow {
  frame: Phaser.GameObjects.Image;
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  pctText: Phaser.GameObjects.Text;
}

const INVENTORY_PANEL_WIDTH = 230;
const INVENTORY_PANEL_HEIGHT = 213;

/**
 * HUD estilizado, todo alineado a la derecha salvo los power-ups (centrados
 * abajo): minimapa arriba a la derecha (Minimap.ts), barras de estado justo
 * encima del inventario, inventario en la esquina inferior derecha.
 *
 * Las barras usan el arte real provisto: cada imagen de barra ya trae un
 * "agujero" recortado con alpha=0 real donde debe ir el relleno — se
 * dibuja un rectángulo de color dinámico DETRÁS de esa imagen (con un
 * fondo oscuro detrás del rectángulo, para la parte no rellenada), y el
 * marco con el agujero queda encima, dando un resultado pixel-perfect sin
 * tener que fabricar la barra a mano.
 */
export class GameHud {
  private scene: Phaser.Scene;

  private hullBar!: BarRow;
  private fuelBar!: BarRow;
  private energyBar!: BarRow;
  private oxygenBar!: BarRow;
  private infoText!: Phaser.GameObjects.Text;

  private inventoryPanel!: Phaser.GameObjects.Image;
  private inventoryIcons: Partial<Record<ResourceType, Phaser.GameObjects.Image>> = {};
  private inventoryTexts: Partial<Record<ResourceType, Phaser.GameObjects.Text>> = {};
  private cargoWarningText!: Phaser.GameObjects.Text;

  private powerupIcons: { key: string; image: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Arc }[] = [];

  constructor(scene: Phaser.Scene, uiLayer: Phaser.GameObjects.Layer) {
    this.scene = scene;

    this.hullBar = this.makeBar(uiLayer, null, 0xff6b6b, "CASCO");
    this.fuelBar = this.makeBar(uiLayer, "hud-fuel-bar", 0xf0a339, "COMBUSTIBLE");
    this.energyBar = this.makeBar(uiLayer, "hud-energy-bar", 0x3d9bf0, "ENERGÍA");
    this.oxygenBar = this.makeBar(uiLayer, "hud-oxygen-bar", 0x3ddbf0, "OXÍGENO");

    this.infoText = this.scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#8ab" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(this.infoText);

    this.createInventoryPanel(uiLayer);
    this.createPowerupsPanel(uiLayer);

    scene.scale.on("resize", () => this.reposition());
    this.reposition();
  }

  // ---------------------------------------------------------- Stat bars ----

  private makeBar(
    uiLayer: Phaser.GameObjects.Layer,
    imageKey: string | null,
    color: number,
    label: string
  ): BarRow {
    const label_ = this.scene.add
      .text(0, 0, label, { fontFamily: "monospace", fontSize: "10px", color: "#9fb8c8" })
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(label_);

    let frame: Phaser.GameObjects.Image;
    let bg: Phaser.GameObjects.Rectangle;
    let fill: Phaser.GameObjects.Rectangle;

    if (imageKey) {
      bg = this.scene.add.rectangle(0, 0, BAR_HOLE_WIDTH * BAR_SCALE, BAR_HOLE_HEIGHT * BAR_SCALE, 0x0a0f16, 0.95);
      bg.setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
      uiLayer.add(bg);

      fill = this.scene.add.rectangle(0, 0, 0, BAR_HOLE_HEIGHT * BAR_SCALE - 2, color, 1);
      fill.setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
      uiLayer.add(fill);

      frame = this.scene.add
        .image(0, 0, imageKey)
        .setDisplaySize(BAR_DISPLAY_WIDTH, BAR_DISPLAY_HEIGHT)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(102);
      uiLayer.add(frame);
    } else {
      // El casco no tiene imagen propia: una barra simple genérica alcanza.
      const w = BAR_HOLE_WIDTH * BAR_SCALE;
      const h = BAR_HOLE_HEIGHT * BAR_SCALE;
      bg = this.scene.add.rectangle(0, 0, w, h, 0x0a0f16, 0.95);
      bg.setOrigin(0, 0.5).setStrokeStyle(1, 0x2a3a45).setScrollFactor(0).setDepth(100);
      uiLayer.add(bg);

      fill = this.scene.add.rectangle(0, 0, 0, h - 2, color, 1);
      fill.setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
      uiLayer.add(fill);

      frame = this.scene.add.image(0, 0, "hud-fuel-bar").setVisible(false); // placeholder inerte
      uiLayer.add(frame);
    }

    const pctText = this.scene.add
      .text(0, 0, "100%", { fontFamily: "monospace", fontSize: "11px", color: "#cfe8f5" })
      .setScrollFactor(0)
      .setDepth(102);
    uiLayer.add(pctText);

    return { frame, bg, fill, label: label_, pctText };
  }

  private layoutBar(bar: BarRow, x: number, y: number, hasImage: boolean) {
    const holeX = hasImage ? x + BAR_HOLE_X * BAR_SCALE : x;
    const holeY = hasImage ? y + BAR_HOLE_Y * BAR_SCALE : y + BAR_DISPLAY_HEIGHT / 2;
    const holeW = BAR_HOLE_WIDTH * BAR_SCALE;

    bar.label.setPosition(x, y - 13);
    bar.bg.setPosition(holeX, holeY);
    // Mantiene la fracción actual del relleno al reposicionar (ej. resize)
    const currentFraction = bar.bg.width > 0 ? bar.fill.width / bar.bg.width : 1;
    bar.fill.setPosition(holeX, holeY);
    bar.fill.width = holeW * currentFraction;
    if (hasImage) {
      bar.frame.setPosition(x, y);
    }
    bar.pctText.setPosition(x + BAR_DISPLAY_WIDTH + 8, holeY - 7);
  }

  private setBarValue(bar: BarRow, current: number, max: number) {
    const fraction = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    bar.fill.width = bar.bg.width * fraction;
    bar.pctText.setText(`${Math.round(fraction * 100)}%`);
  }

  // ------------------------------------------------------ Inventory panel ----

  private createInventoryPanel(uiLayer: Phaser.GameObjects.Layer) {
    this.inventoryPanel = this.scene.add
      .image(0, 0, "hud-inventory-panel")
      .setScrollFactor(0)
      .setDepth(100)
      .setDisplaySize(INVENTORY_PANEL_WIDTH, INVENTORY_PANEL_HEIGHT);
    uiLayer.add(this.inventoryPanel);

    const types: ResourceType[] = ["iron", "ice", "rareMineral"];
    types.forEach((type) => {
      const icon = this.scene.add
        .image(0, 0, ORE_ICON_KEYS[type])
        .setDisplaySize(40, 40)
        .setScrollFactor(0)
        .setDepth(101);
      uiLayer.add(icon);
      this.inventoryIcons[type] = icon;

      const text = this.scene.add
        .text(0, 0, "0", { fontFamily: "monospace", fontSize: "11px", color: "#e8f4ff" })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(101);
      uiLayer.add(text);
      this.inventoryTexts[type] = text;
    });

    this.cargoWarningText = this.scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#ff8080" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101);
    uiLayer.add(this.cargoWarningText);
  }

  // ------------------------------------------------------- Power-ups panel ----

  private createPowerupsPanel(uiLayer: Phaser.GameObjects.Layer) {
    const defs = [
      { key: "hud-powerup-shield", name: "Escudo" },
      { key: "hud-powerup-speed", name: "Velocidad" },
      { key: "hud-powerup-weapon", name: "Armamento" },
    ];
    for (const def of defs) {
      const ring = this.scene.add
        .circle(0, 0, 22, 0x000000, 0)
        .setStrokeStyle(2, POWERUP_STATE_COLORS.disabled)
        .setScrollFactor(0)
        .setDepth(100);
      uiLayer.add(ring);

      const image = this.scene.add
        .image(0, 0, def.key)
        .setDisplaySize(30, 30)
        .setTint(POWERUP_STATE_COLORS.disabled)
        .setAlpha(0.55)
        .setScrollFactor(0)
        .setDepth(101);
      uiLayer.add(image);

      this.powerupIcons.push({ key: def.key, image, ring });
    }
  }

  /** Por ahora no hay mecánica de power-ups activable; deja los 3 en estado
   * "desactivado" (gris, semitransparente) como referencia visual lista
   * para cuando se implementen. */
  setPowerupState(index: number, state: PowerupState) {
    const p = this.powerupIcons[index];
    if (!p) return;
    const color = POWERUP_STATE_COLORS[state];
    p.image.setTint(color);
    p.image.setAlpha(state === "disabled" ? 0.55 : 1);
    p.ring.setStrokeStyle(2, color);
  }

  // ------------------------------------------------------------- Layout ----

  private reposition() {
    const { width, height } = this.scene.scale;

    // Inventario: esquina inferior derecha.
    const invX = width - MARGIN - INVENTORY_PANEL_WIDTH;
    const invY = height - MARGIN - INVENTORY_PANEL_HEIGHT;
    this.inventoryPanel.setPosition(invX + INVENTORY_PANEL_WIDTH / 2, invY + INVENTORY_PANEL_HEIGHT / 2);

    const types: ResourceType[] = ["iron", "ice", "rareMineral"];
    types.forEach((type, i) => {
      const cx = invX + 46 + i * 68;
      const cy = invY + 46;
      this.inventoryIcons[type]?.setPosition(cx, cy);
      this.inventoryTexts[type]?.setPosition(cx, cy + 24);
    });
    this.cargoWarningText.setPosition(invX + INVENTORY_PANEL_WIDTH / 2, invY + INVENTORY_PANEL_HEIGHT - 18);

    // Barras de estado: alineadas a la derecha, apiladas justo encima del
    // inventario (mismo borde derecho que el panel).
    const barX = width - MARGIN - BAR_DISPLAY_WIDTH;
    const infoTextHeight = 16;
    const barsBottomY = invY - 10;
    const barsTopY = barsBottomY - infoTextHeight - ROW_HEIGHT * 4;

    this.layoutBar(this.hullBar, barX, barsTopY, false);
    this.layoutBar(this.fuelBar, barX, barsTopY + ROW_HEIGHT, true);
    this.layoutBar(this.energyBar, barX, barsTopY + ROW_HEIGHT * 2, true);
    this.layoutBar(this.oxygenBar, barX, barsTopY + ROW_HEIGHT * 3, true);
    this.infoText.setPosition(width - MARGIN, barsTopY + ROW_HEIGHT * 4 + 2);

    // Power-ups: centrados en el margen inferior.
    const puY = height - 60;
    const puCenterX = width / 2;
    this.powerupIcons.forEach((p, i) => {
      const cx = puCenterX + (i - 1) * 68;
      p.ring.setPosition(cx, puY);
      p.image.setPosition(cx, puY);
    });
  }

  update(
    ship: PlayerShip,
    inventory: Inventory,
    extra: { speed: number; zoom: number; sectorX: number; sectorY: number }
  ) {
    this.setBarValue(this.hullBar, ship.hull, 100);
    this.setBarValue(this.fuelBar, inventory.fuel, inventory.fuelCapacity);
    this.setBarValue(this.energyBar, inventory.energy, inventory.energyCapacity);
    this.setBarValue(this.oxygenBar, inventory.oxygen, inventory.oxygenCapacity);

    this.infoText.setText(
      `Créditos: ${inventory.credits.toFixed(0)}   Vel: ${extra.speed}   Zoom: ${extra.zoom.toFixed(2)}x   Sector: ${extra.sectorX},${extra.sectorY}`
    );

    const res = inventory.getAll();
    (Object.keys(res) as ResourceType[]).forEach((type) => {
      this.inventoryTexts[type]?.setText(res[type].toFixed(0));
    });

    this.cargoWarningText.setText(
      inventory.isCargoFull
        ? "⚠ CARGA LLENA"
        : `Carga: ${inventory.totalCargoUsed.toFixed(0)}/${inventory.cargoCapacity}`
    );
  }
}
