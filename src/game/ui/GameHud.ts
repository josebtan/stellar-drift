import Phaser from "phaser";
import type { Inventory } from "../systems/Inventory";
import type { PlayerShip } from "../entities/PlayerShip";
import type { ResourceType } from "../entities/Asteroid";

const BAR_WIDTH = 150;
const BAR_HEIGHT = 12;
const ICON_DISPLAY_SIZE = 32;
const ROW_HEIGHT = 40;
const MARGIN = 16;

interface StatBar {
  fill: Phaser.GameObjects.Rectangle;
  pctText: Phaser.GameObjects.Text;
  max: number;
  current: number;
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
 * HUD estilizado (reemplaza el texto plano anterior): barras de estado con
 * ícono propio (casco/combustible/energía/oxígeno), panel de inventario con
 * los recursos recolectados, y panel de power-ups. Todo vive en la capa de
 * UI (cámara sin zoom) — ver el fix de zoom en MainScene.
 */
export class GameHud {
  private scene: Phaser.Scene;

  private hullBar!: StatBar;
  private fuelBar!: StatBar;
  private energyBar!: StatBar;
  private oxygenBar!: StatBar;
  private infoText!: Phaser.GameObjects.Text;

  private inventoryPanel!: Phaser.GameObjects.Image;
  private inventoryTexts: Partial<Record<ResourceType, Phaser.GameObjects.Text>> = {};
  private inventoryDots: Partial<Record<ResourceType, Phaser.GameObjects.Arc>> = {};
  private cargoWarningText!: Phaser.GameObjects.Text;

  private powerupIcons: { key: string; image: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Arc }[] = [];

  constructor(scene: Phaser.Scene, uiLayer: Phaser.GameObjects.Layer) {
    this.scene = scene;

    this.createStatBars(uiLayer);
    this.createInventoryPanel(uiLayer);
    this.createPowerupsPanel(uiLayer);

    scene.scale.on("resize", () => this.reposition());
    this.reposition();
  }

  // ---------------------------------------------------------- Stat bars ----

  private createStatBars(uiLayer: Phaser.GameObjects.Layer) {
    this.hullBar = this.makeBar(uiLayer, MARGIN, MARGIN, null, 0xff6b6b, "CASCO");
    this.fuelBar = this.makeBar(uiLayer, MARGIN, MARGIN + ROW_HEIGHT, "hud-fuel-icon", 0xf0a339, "COMBUSTIBLE");
    this.energyBar = this.makeBar(uiLayer, MARGIN, MARGIN + ROW_HEIGHT * 2, "hud-energy-icon", 0x3d9bf0, "ENERGÍA");
    this.oxygenBar = this.makeBar(uiLayer, MARGIN, MARGIN + ROW_HEIGHT * 3, "hud-oxygen-icon", 0x3ddbf0, "OXÍGENO");

    this.infoText = this.scene.add
      .text(MARGIN, MARGIN + ROW_HEIGHT * 4 + 4, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#8ab",
      })
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(this.infoText);
  }

  private makeBar(
    uiLayer: Phaser.GameObjects.Layer,
    x: number,
    y: number,
    iconKey: string | null,
    color: number,
    label: string
  ): StatBar {
    let barX = x;
    if (iconKey) {
      const icon = this.scene.add
        .image(x + ICON_DISPLAY_SIZE / 2, y + ROW_HEIGHT / 2 - 8, iconKey)
        .setDisplaySize(ICON_DISPLAY_SIZE, ICON_DISPLAY_SIZE)
        .setScrollFactor(0)
        .setDepth(100);
      uiLayer.add(icon);
      barX = x + ICON_DISPLAY_SIZE + 8;
    } else {
      // La barra de casco no tiene ícono propio: un pequeño rombo de color alcanza.
      const marker = this.scene.add
        .rectangle(x + 7, y + ROW_HEIGHT / 2 - 8, 14, 14, color)
        .setAngle(45)
        .setScrollFactor(0)
        .setDepth(100);
      uiLayer.add(marker);
      barX = x + 22;
    }

    const labelText = this.scene.add
      .text(barX, y - 2, label, { fontFamily: "monospace", fontSize: "10px", color: "#9fb8c8" })
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(labelText);

    const track = this.scene.add
      .rectangle(barX, y + 12, BAR_WIDTH, BAR_HEIGHT, 0x0a0f16, 0.9)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x2a3a45)
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(track);

    const fill = this.scene.add
      .rectangle(barX + 1, y + 12, BAR_WIDTH - 2, BAR_HEIGHT - 2, color, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
    uiLayer.add(fill);

    const pctText = this.scene.add
      .text(barX + BAR_WIDTH + 8, y + 5, "100%", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#cfe8f5",
      })
      .setScrollFactor(0)
      .setDepth(100);
    uiLayer.add(pctText);

    return { fill, pctText, max: 100, current: 100 };
  }

  private setBarValue(bar: StatBar, current: number, max: number) {
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
      .setDisplaySize(230, 213); // proporción original ~575x533
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

    // Panel de inventario: centrado abajo, dejando lugar a los joysticks
    // táctiles en las esquinas inferiores.
    const invX = width / 2 - 115;
    const invY = height - 225;
    this.inventoryPanel.setPosition(invX + 115, invY + 106);

    const types: ResourceType[] = ["iron", "ice", "rareMineral"];
    types.forEach((type, i) => {
      const cx = invX + 46 + i * 68;
      const cy = invY + 48;
      this.inventoryDots[type]?.setPosition(cx, cy);
      this.inventoryTexts[type]?.setPosition(cx, cy + 14);
    });
    this.cargoWarningText.setPosition(invX + 115, invY + 195);

    // Panel de power-ups: fila arriba del inventario
    const puY = invY - 34;
    this.powerupIcons.forEach((p, i) => {
      const cx = invX + 46 + i * 68;
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
        ? "⚠ CARGA LLENA — vendé en una estación"
        : `Carga: ${inventory.totalCargoUsed.toFixed(0)}/${inventory.cargoCapacity}`
    );
  }
}
