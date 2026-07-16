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

const INVENTORY_PANEL_WIDTH = 230;
const INVENTORY_PANEL_HEIGHT = 213;

const BAR_DISPLAY_WIDTH = INVENTORY_PANEL_WIDTH;
const BAR_SCALE = BAR_DISPLAY_WIDTH / BAR_IMAGE_WIDTH;
const BAR_DISPLAY_HEIGHT = BAR_IMAGE_HEIGHT * BAR_SCALE;
const ROW_HEIGHT = BAR_DISPLAY_HEIGHT + 6;
const MARGIN = 16;
// El relleno se dibuja un poco más grande que el agujero medido, para que
// cualquier desajuste de subpíxel quede escondido debajo del marco (que se
// dibuja encima) en vez de dejar un borde sin cubrir.
const HOLE_PADDING_X = 6;
const HOLE_PADDING_Y = 4;

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
  frame: Phaser.GameObjects.Image | null;
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  pctText: Phaser.GameObjects.Text;
  holeWidthPx: number;
}

// Centros de cada slot medidos sobre la imagen original (575x533), fila
// superior (las otras 2 filas quedan libres para futuros ítems/power-ups).
const INVENTORY_SLOT_CENTERS = [
  { x: 108.5, y: 138 },
  { x: 229, y: 138 },
  { x: 348.5, y: 138 },
];
const INVENTORY_IMAGE_SIZE = { w: 575, h: 533 };

/**
 * HUD estilizado, todo alineado a la derecha salvo los power-ups (centrados
 * abajo): minimapa arriba a la derecha (Minimap.ts), barras de estado justo
 * encima del inventario, inventario en la esquina inferior derecha.
 */
export class GameHud {
  private scene: Phaser.Scene;

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

  private makeBar(uiLayer: Phaser.GameObjects.Layer, imageKey: string, color: number, label: string): BarRow {
    const holeW = (BAR_HOLE_WIDTH + HOLE_PADDING_X * 2) * BAR_SCALE;
    const holeH = (BAR_HOLE_HEIGHT + HOLE_PADDING_Y * 2) * BAR_SCALE;

    // El relleno va DETRÁS del marco (depth menor), y un poco más grande
    // que el agujero real para no dejar bordes sin cubrir.
    const bg = this.scene.add.rectangle(0, 0, holeW, holeH, 0x0a0f16, 0.95);
    bg.setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    uiLayer.add(bg);

    const fill = this.scene.add.rectangle(0, 0, 0, holeH, color, 1);
    fill.setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    uiLayer.add(fill);

    const frame = this.scene.add
      .image(0, 0, imageKey)
      .setDisplaySize(BAR_DISPLAY_WIDTH, BAR_DISPLAY_HEIGHT)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(102);
    uiLayer.add(frame);

    // Título y porcentaje se dibujan ENCIMA del propio sprite (no afuera),
    // en negrita y con el color de la barra.
    const label_ = this.scene.add
      .text(0, 0, label, {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setScrollFactor(0)
      .setDepth(103);
    uiLayer.add(label_);

    const pctText = this.scene.add
      .text(0, 0, "100%", {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(103);
    uiLayer.add(pctText);

    return { frame, bg, fill, label: label_, pctText, holeWidthPx: holeW };
  }

  private layoutBar(bar: BarRow, x: number, y: number) {
    const holeX = x + BAR_HOLE_X * BAR_SCALE - HOLE_PADDING_X * BAR_SCALE;
    const holeY = y + BAR_HOLE_Y * BAR_SCALE + (BAR_HOLE_HEIGHT * BAR_SCALE) / 2;

    // Mantiene la fracción actual del relleno al reposicionar (ej. resize)
    const currentFraction = bar.holeWidthPx > 0 ? bar.fill.width / bar.holeWidthPx : 1;
    bar.bg.setPosition(holeX, holeY);
    bar.fill.setPosition(holeX, holeY);
    bar.fill.width = bar.holeWidthPx * currentFraction;
    bar.frame?.setPosition(x, y);

    // Título: en la franja oscura arriba del agujero, después del ícono
    // (posición original, antes de bajarlo de más).
    bar.label.setPosition(x + BAR_HOLE_X * BAR_SCALE, y + 6);
    // Porcentaje: misma fila que el título, alineado con el final de la
    // barra (el borde derecho del hueco de relleno), no con el borde del sprite.
    bar.pctText.setPosition(holeX + bar.holeWidthPx, y + 6);
  }

  private setBarValue(bar: BarRow, current: number, max: number) {
    const fraction = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    bar.fill.width = bar.holeWidthPx * fraction;
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
        .setDisplaySize(28, 28)
        .setScrollFactor(0)
        .setDepth(101)
        .setVisible(false); // el inventario arranca vacío hasta recolectar algo
      uiLayer.add(icon);
      this.inventoryIcons[type] = icon;

      const text = this.scene.add
        .text(0, 0, "0", {
          fontFamily: "Arial, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102)
        .setVisible(false);
      uiLayer.add(text);
      this.inventoryTexts[type] = text;
    });

    this.cargoWarningText = this.scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#ff8080" })
      .setOrigin(1, 1)
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

    const sx = INVENTORY_PANEL_WIDTH / INVENTORY_IMAGE_SIZE.w;
    const sy = INVENTORY_PANEL_HEIGHT / INVENTORY_IMAGE_SIZE.h;
    const types: ResourceType[] = ["iron", "ice", "rareMineral"];
    types.forEach((type, i) => {
      const slot = INVENTORY_SLOT_CENTERS[i];
      const cx = invX + slot.x * sx;
      const cy = invY + slot.y * sy;
      this.inventoryIcons[type]?.setPosition(cx, cy);
      // Cantidad en la esquina inferior derecha del ícono.
      this.inventoryTexts[type]?.setPosition(cx + 14, cy + 14);
    });

    // El contador de carga va JUSTO ARRIBA del panel (no se superpone con
    // el diseño del marco inferior, que antes lo tapaba parcialmente).
    this.cargoWarningText.setPosition(invX + INVENTORY_PANEL_WIDTH - 4, invY - 4);

    // Barras de estado: alineadas a la derecha, apiladas justo encima del
    // inventario (mismo borde derecho que el panel).
    const barX = width - MARGIN - BAR_DISPLAY_WIDTH;
    const infoTextHeight = 16;
    const cargoRowHeight = 18;
    const barsBottomY = invY - cargoRowHeight - 6;
    const barsTopY = barsBottomY - infoTextHeight - ROW_HEIGHT * 3;

    this.layoutBar(this.fuelBar, barX, barsTopY);
    this.layoutBar(this.energyBar, barX, barsTopY + ROW_HEIGHT);
    this.layoutBar(this.oxygenBar, barX, barsTopY + ROW_HEIGHT * 2);
    this.infoText.setPosition(width - MARGIN, barsTopY + ROW_HEIGHT * 3 + 2);

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
    this.setBarValue(this.fuelBar, inventory.fuel, inventory.fuelCapacity);
    this.setBarValue(this.energyBar, inventory.energy, inventory.energyCapacity);
    this.setBarValue(this.oxygenBar, inventory.oxygen, inventory.oxygenCapacity);

    this.infoText.setText(
      `Casco: ${ship.hull.toFixed(0)}%   Créditos: ${inventory.credits.toFixed(0)}   Vel: ${extra.speed}   Zoom: ${extra.zoom.toFixed(2)}x   Sector: ${extra.sectorX},${extra.sectorY}`
    );

    const res = inventory.getAll();
    (Object.keys(res) as ResourceType[]).forEach((type) => {
      const amount = res[type];
      const has = amount > 0;
      this.inventoryIcons[type]?.setVisible(has);
      this.inventoryTexts[type]?.setVisible(has);
      if (has) this.inventoryTexts[type]?.setText(amount.toFixed(0));
    });

    this.cargoWarningText.setText(
      inventory.isCargoFull
        ? "⚠ CARGA LLENA"
        : `Carga: ${inventory.totalCargoUsed.toFixed(0)}/${inventory.cargoCapacity}`
    );
  }
}
