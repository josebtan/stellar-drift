import Phaser from "phaser";
import type { Inventory } from "../systems/Inventory";
import type { PlayerShip } from "../entities/PlayerShip";
import type { ResourceType } from "../entities/Asteroid";
import { getUiScale } from "../uiScale";
import {
  BAR_IMAGE_WIDTH,
  BAR_IMAGE_HEIGHT,
  BAR_HOLE_X,
  BAR_HOLE_Y,
  BAR_HOLE_WIDTH,
  BAR_HOLE_HEIGHT,
  EMERGENCY_IMAGE_WIDTH,
  EMERGENCY_IMAGE_HEIGHT,
  EMERGENCY_LIGHT_RADIUS,
  EMERGENCY_LIGHT_CENTERS,
  EMERGENCY_TEXT_CENTER,
  EMERGENCY_TEXT_MAX_WIDTH,
} from "../assetConstants";

// Todos los tamaños de acá son los de "diseño" (equivalen a uiScale=1,
// el tamaño que ya tenía el HUD en desktop). reposition() los multiplica
// por el factor de escala actual antes de aplicarlos, así que en celular
// (uiScale < 1) todo el HUD se achica proporcionalmente en vez de
// desbordar o solaparse.
const BASE_INVENTORY_PANEL_WIDTH = 230;
const BASE_INVENTORY_PANEL_HEIGHT = 213;
const BASE_MARGIN = 16;
const BASE_EMERGENCY_GAP = 10;
const BASE_ROW_GAP = 6; // separación extra entre filas de barras

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
 *
 * Totalmente responsivo: en cada resize (incluye rotación de pantalla en
 * celular) reposition() recalcula un factor de escala (ver uiScale.ts) y
 * re-dimensiona TODOS los elementos, no solo su posición.
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

  private emergencyIcon!: Phaser.GameObjects.Image;
  private emergencyText!: Phaser.GameObjects.Text;
  private emergencyLights: Phaser.GameObjects.Arc[] = [];
  private emergencyActive = false;
  private emergencyBlinkTween: Phaser.Tweens.Tween | null = null;
  /** Asignado desde afuera (MainScene): qué hacer al tocar el botón. */
  onEmergencyClick: (() => void) | null = null;

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
    this.createEmergencyButton(uiLayer);

    scene.scale.on("resize", () => this.reposition());
    this.reposition();
  }

  // ---------------------------------------------------------- Stat bars ----

  private makeBar(uiLayer: Phaser.GameObjects.Layer, imageKey: string, color: number, label: string): BarRow {
    // El relleno va DETRÁS del marco (depth menor); el tamaño real se fija
    // en layoutBar() en cada reposition, acá arrancan en 0.
    const bg = this.scene.add.rectangle(0, 0, 0, 0, 0x0a0f16, 0.95);
    bg.setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    uiLayer.add(bg);

    const fill = this.scene.add.rectangle(0, 0, 0, 0, color, 1);
    fill.setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    uiLayer.add(fill);

    const frame = this.scene.add.image(0, 0, imageKey).setOrigin(0, 0).setScrollFactor(0).setDepth(102);
    uiLayer.add(frame);

    // Título y porcentaje se dibujan ENCIMA del propio sprite (no afuera),
    // en negrita y con el color de la barra.
    const label_ = this.scene.add
      .text(0, 0, label, {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setScrollFactor(0)
      .setDepth(103);
    uiLayer.add(label_);

    const pctText = this.scene.add
      .text(0, 0, "100%", {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(103);
    uiLayer.add(pctText);

    return { frame, bg, fill, label: label_, pctText, holeWidthPx: 0 };
  }

  /** Redimensiona y reposiciona una barra para el tamaño de fila actual
   * (displayWidth/displayHeight ya vienen escalados por uiScale). */
  private layoutBar(bar: BarRow, x: number, y: number, displayWidth: number, displayHeight: number, scale: number) {
    const barScale = displayWidth / BAR_IMAGE_WIDTH;
    // El relleno se dibuja un poco más grande que el agujero medido, para
    // que cualquier desajuste de subpíxel quede escondido debajo del marco
    // (que se dibuja encima) en vez de dejar un borde sin cubrir.
    const holePaddingX = 6 * barScale;
    const holePaddingY = 4 * barScale;
    const holeW = BAR_HOLE_WIDTH * barScale + holePaddingX * 2;
    const holeH = BAR_HOLE_HEIGHT * barScale + holePaddingY * 2;
    const holeX = x + BAR_HOLE_X * barScale - holePaddingX;
    const holeY = y + BAR_HOLE_Y * barScale + (BAR_HOLE_HEIGHT * barScale) / 2;

    // Mantiene la fracción actual del relleno al reposicionar (ej. resize).
    const currentFraction = bar.holeWidthPx > 0 ? bar.fill.width / bar.holeWidthPx : 1;
    bar.holeWidthPx = holeW;
    bar.bg.setPosition(holeX, holeY).setSize(holeW, holeH);
    bar.fill.setPosition(holeX, holeY).setSize(holeW * currentFraction, holeH);
    bar.frame.setPosition(x, y).setDisplaySize(displayWidth, displayHeight);

    // Título: en la franja oscura arriba del agujero, después del ícono.
    bar.label.setFontSize(Math.round(13 * scale));
    bar.label.setPosition(x + BAR_HOLE_X * barScale, y + 8 * scale);
    // Porcentaje: misma fila que el título, alineado con el final de la
    // barra (el borde derecho del hueco de relleno), no con el borde del sprite.
    bar.pctText.setFontSize(Math.round(10 * scale));
    bar.pctText.setPosition(holeX + holeW, y + 10 * scale);
  }

  private setBarValue(bar: BarRow, current: number, max: number) {
    const fraction = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    bar.fill.width = bar.holeWidthPx * fraction;
    bar.pctText.setText(`${Math.round(fraction * 100)}%`);
  }

  // ------------------------------------------------------ Inventory panel ----

  private createInventoryPanel(uiLayer: Phaser.GameObjects.Layer) {
    this.inventoryPanel = this.scene.add.image(0, 0, "hud-inventory-panel").setScrollFactor(0).setDepth(100);
    uiLayer.add(this.inventoryPanel);

    const types: ResourceType[] = ["iron", "ice", "rareMineral"];
    types.forEach((type) => {
      const icon = this.scene.add
        .image(0, 0, ORE_ICON_KEYS[type])
        .setScrollFactor(0)
        .setDepth(101)
        .setVisible(false); // el inventario arranca vacío hasta recolectar algo
      uiLayer.add(icon);
      this.inventoryIcons[type] = icon;

      const text = this.scene.add
        .text(0, 0, "0", {
          fontFamily: "Arial, sans-serif",
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
      .text(0, 0, "", { fontFamily: "monospace", color: "#ff8080" })
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

  // -------------------------------------------------- Botón de emergencia ----

  /** Botón de emergencia: oculto por defecto, aparece parpadeando cuando el
   * combustible llega a 0. Va a la izquierda de la barra de combustible. */
  private createEmergencyButton(uiLayer: Phaser.GameObjects.Layer) {
    this.emergencyIcon = this.scene.add
      .image(0, 0, "hud-emergency-call")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(104)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.onEmergencyClick?.());
    uiLayer.add(this.emergencyIcon);

    this.emergencyText = this.scene.add
      .text(0, 0, "Emergencia", {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        color: "#ffd9a0",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(105)
      .setVisible(false);
    uiLayer.add(this.emergencyText);

    // 8 luces de advertencia: huecos con alpha=0 reales en el sprite,
    // repartidos por el marco. Parpadean en rojo cuando está activo.
    this.emergencyLights = EMERGENCY_LIGHT_CENTERS.map(() => {
      const light = this.scene.add
        .circle(0, 0, EMERGENCY_LIGHT_RADIUS, 0xff3b30, 1)
        .setScrollFactor(0)
        .setDepth(105)
        .setVisible(false);
      uiLayer.add(light);
      return light;
    });
  }

  private layoutEmergencyButton(x: number, y: number, displayWidth: number, displayHeight: number, scale: number) {
    const emergencyScale = displayWidth / EMERGENCY_IMAGE_WIDTH;
    this.emergencyIcon.setPosition(x, y).setDisplaySize(displayWidth, displayHeight);

    this.emergencyText.setFontSize(Math.round(8 * scale));
    this.emergencyText.setWordWrapWidth(EMERGENCY_TEXT_MAX_WIDTH * emergencyScale, true);
    this.emergencyText.setPosition(
      x + EMERGENCY_TEXT_CENTER.x * emergencyScale,
      y + EMERGENCY_TEXT_CENTER.y * emergencyScale
    );

    this.emergencyLights.forEach((light, i) => {
      const c = EMERGENCY_LIGHT_CENTERS[i];
      light.setRadius(EMERGENCY_LIGHT_RADIUS * emergencyScale);
      light.setPosition(x + c.x * emergencyScale, y + c.y * emergencyScale);
    });
  }

  /** Muestra/oculta el botón y arranca/detiene el parpadeo de las luces
   * solo en el flanco de cambio (no en cada frame). */
  private setEmergencyActive(active: boolean) {
    if (active === this.emergencyActive) return;
    this.emergencyActive = active;

    this.emergencyIcon.setVisible(active);
    this.emergencyText.setVisible(active);
    this.emergencyLights.forEach((l) => l.setVisible(active));

    if (active) {
      this.emergencyBlinkTween?.stop();
      this.emergencyLights.forEach((l) => l.setAlpha(1));
      this.emergencyBlinkTween = this.scene.tweens.add({
        targets: this.emergencyLights,
        alpha: { from: 1, to: 0.15 },
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.emergencyBlinkTween?.stop();
      this.emergencyBlinkTween = null;
    }
  }

  /** Refleja si ya hay una grúa contratada en camino/trabajando: atenúa el
   * ícono y deja de responder a clicks hasta que termine el servicio. */
  setEmergencyBusy(busy: boolean) {
    this.emergencyIcon.setAlpha(busy ? 0.5 : 1);
    if (busy) this.emergencyIcon.disableInteractive();
    else this.emergencyIcon.setInteractive({ useHandCursor: true });
  }

  // ------------------------------------------------------------- Layout ----

  private reposition() {
    const { width, height } = this.scene.scale;
    const scale = getUiScale(this.scene);

    const margin = BASE_MARGIN * scale;
    const invW = BASE_INVENTORY_PANEL_WIDTH * scale;
    const invH = BASE_INVENTORY_PANEL_HEIGHT * scale;
    const barW = invW; // las barras comparten ancho con el panel de inventario
    const barScale = barW / BAR_IMAGE_WIDTH;
    const barH = BAR_IMAGE_HEIGHT * barScale;
    const rowHeight = barH + BASE_ROW_GAP * scale;
    const emergencyGap = BASE_EMERGENCY_GAP * scale;
    const emergencyH = rowHeight - 2 * scale;
    const emergencyW = emergencyH * (EMERGENCY_IMAGE_WIDTH / EMERGENCY_IMAGE_HEIGHT);

    // Inventario: esquina inferior derecha.
    const invX = width - margin - invW;
    const invY = height - margin - invH;
    this.inventoryPanel.setPosition(invX + invW / 2, invY + invH / 2).setDisplaySize(invW, invH);

    const sx = invW / INVENTORY_IMAGE_SIZE.w;
    const sy = invH / INVENTORY_IMAGE_SIZE.h;
    const iconSize = 28 * scale;
    const types: ResourceType[] = ["iron", "ice", "rareMineral"];
    types.forEach((type, i) => {
      const slot = INVENTORY_SLOT_CENTERS[i];
      const cx = invX + slot.x * sx;
      const cy = invY + slot.y * sy;
      this.inventoryIcons[type]?.setPosition(cx, cy).setDisplaySize(iconSize, iconSize);
      // Cantidad en la esquina inferior derecha del ícono.
      this.inventoryTexts[type]?.setFontSize(Math.round(11 * scale)).setPosition(cx + 14 * scale, cy + 14 * scale);
    });

    // El contador de carga va JUSTO ARRIBA del panel (no se superpone con
    // el diseño del marco inferior, que antes lo tapaba parcialmente).
    this.cargoWarningText.setFontSize(Math.round(12 * scale)).setPosition(invX + invW - 4 * scale, invY - 4 * scale);

    // Barras de estado: alineadas a la derecha, apiladas justo encima del
    // inventario (mismo borde derecho que el panel).
    const barX = width - margin - barW;
    const infoTextHeight = 16 * scale;
    const cargoRowHeight = 18 * scale;
    const barsBottomY = invY - cargoRowHeight - 6 * scale;
    const barsTopY = barsBottomY - infoTextHeight - rowHeight * 3;

    this.layoutBar(this.fuelBar, barX, barsTopY, barW, barH, scale);
    this.layoutBar(this.energyBar, barX, barsTopY + rowHeight, barW, barH, scale);
    this.layoutBar(this.oxygenBar, barX, barsTopY + rowHeight * 2, barW, barH, scale);
    this.infoText.setFontSize(Math.round(12 * scale)).setPosition(width - margin, barsTopY + rowHeight * 3 + 2 * scale);

    // Botón de emergencia: a la izquierda de la barra de combustible,
    // centrado verticalmente con ella.
    const fuelCenterY = barsTopY + barH / 2;
    this.layoutEmergencyButton(
      barX - emergencyGap - emergencyW,
      fuelCenterY - emergencyH / 2,
      emergencyW,
      emergencyH,
      scale
    );

    // Power-ups: centrados en el margen inferior. En pantallas angostas se
    // acercan un poco más entre sí para no desbordar los bordes.
    const puY = height - 60 * scale;
    const puCenterX = width / 2;
    const puSpacing = 68 * scale;
    const puIconSize = 30 * scale;
    this.powerupIcons.forEach((p, i) => {
      const cx = puCenterX + (i - 1) * puSpacing;
      p.ring.setPosition(cx, puY).setRadius(22 * scale);
      p.image.setPosition(cx, puY).setDisplaySize(puIconSize, puIconSize);
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
    this.setEmergencyActive(inventory.fuel <= 0);

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
