import Phaser from "phaser";
import type { Inventory } from "../systems/Inventory";
import type { PlayerShip } from "../entities/PlayerShip";
import type { ResourceType } from "../entities/Asteroid";

const BAR_WIDTH = 150;
const BAR_HEIGHT = 12;
const ICON_DISPLAY_SIZE = 32;
const ROW_HEIGHT = 40;
const MARGIN = 16;
const BLOCK_WIDTH = ICON_DISPLAY_SIZE + 8 + BAR_WIDTH + 8 + 40; // icono + gap + barra + gap + "100%"

const INVENTORY_PANEL_WIDTH = 230;
const INVENTORY_PANEL_HEIGHT = 213;

interface BarRow {
  icon: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  track: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  pctText: Phaser.GameObjects.Text;
}

const RESOURCE_TINTS: Record<ResourceType, number> = {
  iron: 0xb3a48c,
  ice: 0x9fd9ff,
  rareMineral: 0xcf9dff,
};

type PowerupState = "active" | "inUse" | "critical" | "disabled";
const POWERUP_STATE_COLORS: Record<PowerupState, number> = {
  active: 0x5ad16d,
  inUse: 0xff9c3d,
  critical: 0xff4d4d,
  disabled: 0x555555,
};

/**
 * HUD estilizado, todo alineado a la derecha salvo los power-ups (centrados
 * abajo): minimapa arriba a la derecha (ver Minimap.ts), barras de estado
 * justo encima del inventario, inventario en la esquina inferior derecha.
 */
export class GameHud {
  private scene: Phaser.Scene;

  private hullBar!: BarRow;
  private fuelBar!: BarRow;
  private energyBar!: BarRow;
  private oxygenBar!: BarRow;
  private infoText!: Phaser.GameObjects.Text;

  private inventoryPanel!: Phaser.GameObjects.Image;
  private inventoryTexts: Partial<Record<ResourceType, Phaser.GameObjects.Text>> = {};
  private inventoryDots: Partial<Record<ResourceType, Phaser.GameObjects.Arc>> = {};
  private cargoWarningText!: Phaser.GameObjects.Text;

  private powerupIcons: { key: string; image: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Arc }[] = [];

  constructor(scene: Phaser.Scene, uiLayer: Phaser.GameObjects.Layer) {
    this.scene = scene;

    this.hullBar = this.makeBar(uiLayer, null, 0xff6b6b, "CASCO");
    this.fuelBar = this.makeBar(uiLayer, "hud-fuel-icon", 0xf0a339, "COMBUSTIBLE");
    this.energyBar = this.makeBar(uiLayer, "hud-energy-icon", 0x3d9bf0, "ENERGÍA");
    this.oxygenBar = this.makeBar(uiLayer, "hud-oxygen-icon", 0x3ddbf0, "OXÍGENO");

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

  /** Crea una fila de barra sin posicionarla todavía (reposition() la ubica). */
  private makeBar(
    uiLayer: Phaser.GameObjects.Layer,
    iconKey: string | null,
    color: number,
    label: string
  ): BarRow {
    const icon = iconKey
      ? this.scene.add.image(0, 0, iconKey).setDisplaySize(ICON_DISPLAY_SIZE, ICON_DISPLAY_SIZE)
      : this.scene.add.rectangle(0, 0, 14, 14, color).setAngle(45);
    icon.setScrollFactor(0).setDepth(100);
    uiLayer.add(icon);

    const label_ = this.scene.add
      .text(0, 0, label, { fontFamily: "monospace", fontSize: "10px", color: "#9fb8c8" })
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(label_);

    const track = this.scene.add
      .rectangle(0, 0, BAR_WIDTH, BAR_HEIGHT, 0x0a0f16, 0.9)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x2a3a45)
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(track);

    const fill = this.scene.add
      .rectangle(0, 0, BAR_WIDTH - 2, BAR_HEIGHT - 2, color, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
    uiLayer.add(fill);

    const pctText = this.scene.add
      .text(0, 0, "100%", { fontFamily: "monospace", fontSize: "11px", color: "#cfe8f5" })
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(pctText);

    return { icon, label: label_, track, fill, pctText };
  }

  private layoutBar(bar: BarRow, blockX: number, y: number) {
    bar.icon.setPosition(blockX + ICON_DISPLAY_SIZE / 2, y + ROW_HEIGHT / 2 - 8);
    const barX = blockX + ICON_DISPLAY_SIZE + 8;
    bar.label.setPosition(barX, y - 2);
    bar.track.setPosition(barX, y + 12);
    // Mantiene el ancho actual del relleno (proporcional) al reposicionar
    const currentFraction = bar.track.width > 0 ? bar.fill.width / (bar.track.width - 2) : 1;
    bar.fill.setPosition(barX + 1, y + 12);
    bar.fill.width = Math.max(0, (BAR_WIDTH - 2) * currentFraction);
    bar.pctText.setPosition(barX + BAR_WIDTH + 8, y + 5);
  }

  private setBarValue(bar: BarRow, current: number, max: number) {
    const fraction = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    bar.fill.width = Math.max(0, (BAR_WIDTH - 2) * fraction);
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
      const dot = this.scene.add
        .circle(0, 0, 9, RESOURCE_TINTS[type])
        .setScrollFactor(0)
        .setDepth(101)
        .setStrokeStyle(1, 0xffffff, 0.4);
      uiLayer.add(dot);
      this.inventoryDots[type] = dot;

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
        .setDisplaySize(28, 34)
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
      const cy = invY + 48;
      this.inventoryDots[type]?.setPosition(cx, cy);
      this.inventoryTexts[type]?.setPosition(cx, cy + 14);
    });
    this.cargoWarningText.setPosition(invX + INVENTORY_PANEL_WIDTH / 2, invY + INVENTORY_PANEL_HEIGHT - 18);

    // Barras de estado: alineadas a la derecha, apiladas justo encima del
    // inventario (mismo borde derecho que el panel).
    const blockX = width - MARGIN - BLOCK_WIDTH;
    const infoTextHeight = 16;
    const barsBottomY = invY - 10;
    const barsTopY = barsBottomY - infoTextHeight - ROW_HEIGHT * 4;

    this.layoutBar(this.hullBar, blockX, barsTopY);
    this.layoutBar(this.fuelBar, blockX, barsTopY + ROW_HEIGHT);
    this.layoutBar(this.energyBar, blockX, barsTopY + ROW_HEIGHT * 2);
    this.layoutBar(this.oxygenBar, blockX, barsTopY + ROW_HEIGHT * 3);
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
