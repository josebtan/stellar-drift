import Phaser from "phaser";

const JOYSTICK_RADIUS = 70;
const JOYSTICK_DEADZONE = 14;
const ZOOM_WHEEL_SENSITIVITY = 0.001;
const ZOOM_PINCH_SENSITIVITY = 0.006;

interface Vec2 {
  x: number;
  y: number;
}

/**
 * Unifica el input de PC (teclado + mouse) y móvil (dos joysticks táctiles +
 * pellizco para zoom) detrás de una única interfaz que MainScene consulta
 * cada frame. La nave siempre queda centrada en pantalla, así que el ángulo
 * de apuntado se calcula directo desde el centro del viewport al puntero/
 * joystick — no hace falta convertir a coordenadas de mundo.
 */
export class InputController {
  private scene: Phaser.Scene;
  private isTouchDevice: boolean;

  // Teclado (PC): movimiento en espacio absoluto (no relativo a hacia dónde
  // apunta la nave, ya que apuntar ahora lo controla el cursor/joystick).
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };

  // Mouse (PC)
  private mouseAimAngle: number | null = null;
  private mouseFiring = false;

  // Joystick de movimiento (táctil)
  private moveAnchor: Vec2 = { x: 0, y: 0 };
  private moveTouchId: number | null = null;
  private moveVector: Vec2 = { x: 0, y: 0 };
  private moveKnobOffset: Vec2 = { x: 0, y: 0 };

  // Joystick de apuntado + disparo (táctil): moverlo more allá de la zona
  // muerta apunta la nave hacia esa dirección Y dispara, como en la mayoría
  // de los twin-stick shooters móviles (evita necesitar un botón aparte).
  private aimAnchor: Vec2 = { x: 0, y: 0 };
  private aimTouchId: number | null = null;
  private aimAngle: number | null = null;
  private aimFiring = false;
  private aimKnobOffset: Vec2 = { x: 0, y: 0 };

  // Pellizco para zoom (dos dedos fuera de los joysticks)
  private pinchIds: number[] = [];
  private pinchLastDist = 0;

  private zoomAccum = 0;

  // Visuales de los joysticks (solo se crean/muestran en dispositivos táctiles)
  private touchGraphics: Phaser.GameObjects.Graphics | null = null;

  /** true si el dispositivo usa controles táctiles (joysticks) en vez de mouse+teclado */
  readonly isTouch: boolean;

  constructor(scene: Phaser.Scene, uiLayer?: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.isTouchDevice = scene.sys.game.device.input.touch;
    this.isTouch = this.isTouchDevice;

    this.setupKeyboard();
    this.repositionAnchors();

    if (this.isTouchDevice) {
      this.setupTouch(uiLayer);
    } else {
      this.setupMouse();
    }

    scene.scale.on("resize", () => this.repositionAnchors());
  }

  private setupKeyboard() {
    const kb = this.scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private repositionAnchors() {
    const { width, height } = this.scene.scale;
    this.moveAnchor = { x: 120, y: height - 120 };
    this.aimAnchor = { x: width - 120, y: height - 120 };
  }

  // ---------------------------------------------------------------- PC ----

  private setupMouse() {
    this.scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.updateMouseAim(p);
    });
    this.scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.updateMouseAim(p);
      if (p.leftButtonDown()) this.mouseFiring = true;
    });
    this.scene.input.on("pointerup", () => {
      this.mouseFiring = false;
    });
    this.scene.input.on(
      "wheel",
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.zoomAccum -= dy * ZOOM_WHEEL_SENSITIVITY;
      }
    );
  }

  private updateMouseAim(p: Phaser.Input.Pointer) {
    const { width, height } = this.scene.scale;
    this.mouseAimAngle = Phaser.Math.Angle.Between(width / 2, height / 2, p.x, p.y);
  }

  // ------------------------------------------------------------ Touch ----

  private setupTouch(uiLayer?: Phaser.GameObjects.Layer) {
    this.touchGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(150);
    uiLayer?.add(this.touchGraphics);

    this.scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onTouchDown(p));
    this.scene.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onTouchMove(p));
    this.scene.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onTouchUp(p));
    this.scene.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.onTouchUp(p));
  }

  private onTouchDown(p: Phaser.Input.Pointer) {
    const distMove = Phaser.Math.Distance.Between(p.x, p.y, this.moveAnchor.x, this.moveAnchor.y);
    const distAim = Phaser.Math.Distance.Between(p.x, p.y, this.aimAnchor.x, this.aimAnchor.y);

    if (this.moveTouchId === null && distMove <= JOYSTICK_RADIUS * 1.6) {
      this.moveTouchId = p.id;
      this.onTouchMove(p);
      return;
    }
    if (this.aimTouchId === null && distAim <= JOYSTICK_RADIUS * 1.6) {
      this.aimTouchId = p.id;
      this.onTouchMove(p);
      return;
    }

    // No cayó en ningún joystick: candidato para pellizco de zoom.
    if (this.pinchIds.length < 2 && !this.pinchIds.includes(p.id)) {
      this.pinchIds.push(p.id);
      if (this.pinchIds.length === 2) {
        this.pinchLastDist = this.currentPinchDistance();
      }
    }
  }

  private onTouchMove(p: Phaser.Input.Pointer) {
    if (p.id === this.moveTouchId) {
      const v = this.clampToJoystick(p.x - this.moveAnchor.x, p.y - this.moveAnchor.y);
      this.moveKnobOffset = v;
      const mag = Math.hypot(v.x, v.y);
      if (mag < JOYSTICK_DEADZONE) {
        this.moveVector = { x: 0, y: 0 };
      } else {
        this.moveVector = { x: v.x / JOYSTICK_RADIUS, y: v.y / JOYSTICK_RADIUS };
      }
      return;
    }

    if (p.id === this.aimTouchId) {
      const v = this.clampToJoystick(p.x - this.aimAnchor.x, p.y - this.aimAnchor.y);
      this.aimKnobOffset = v;
      const mag = Math.hypot(v.x, v.y);
      if (mag < JOYSTICK_DEADZONE) {
        this.aimFiring = false;
      } else {
        this.aimAngle = Math.atan2(v.y, v.x);
        this.aimFiring = true;
      }
      return;
    }

    if (this.pinchIds.includes(p.id) && this.pinchIds.length === 2) {
      const dist = this.currentPinchDistance();
      this.zoomAccum += (dist - this.pinchLastDist) * ZOOM_PINCH_SENSITIVITY;
      this.pinchLastDist = dist;
    }
  }

  private onTouchUp(p: Phaser.Input.Pointer) {
    if (p.id === this.moveTouchId) {
      this.moveTouchId = null;
      this.moveVector = { x: 0, y: 0 };
      this.moveKnobOffset = { x: 0, y: 0 };
    }
    if (p.id === this.aimTouchId) {
      this.aimTouchId = null;
      this.aimFiring = false;
      this.aimKnobOffset = { x: 0, y: 0 };
      // El ángulo se mantiene (this.aimAngle) para que la nave no "olvide"
      // hacia dónde miraba al soltar el joystick.
    }
    const idx = this.pinchIds.indexOf(p.id);
    if (idx !== -1) this.pinchIds.splice(idx, 1);
  }

  private currentPinchDistance(): number {
    const pointers = this.scene.input.manager.pointers;
    const a = pointers.find((ptr) => ptr.id === this.pinchIds[0]);
    const b = pointers.find((ptr) => ptr.id === this.pinchIds[1]);
    if (!a || !b) return this.pinchLastDist;
    return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
  }

  private clampToJoystick(dx: number, dy: number): Vec2 {
    const dist = Math.hypot(dx, dy);
    if (dist <= JOYSTICK_RADIUS) return { x: dx, y: dy };
    const scale = JOYSTICK_RADIUS / dist;
    return { x: dx * scale, y: dy * scale };
  }

  // -------------------------------------------------------------- API ----

  /** Devuelve el vector de traslación deseado, cada eje en [-1, 1]. */
  getMoveVector(): Vec2 {
    if (this.isTouchDevice) {
      return this.moveVector;
    }
    let x = 0;
    let y = 0;
    if (this.keys.left.isDown || this.keys.a.isDown) x -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) x += 1;
    if (this.keys.up.isDown || this.keys.w.isDown) y -= 1;
    if (this.keys.down.isDown || this.keys.s.isDown) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** Ángulo (rad) hacia el que la nave debe apuntar, o null si no hay input activo aún. */
  getAimAngle(): number | null {
    return this.isTouchDevice ? this.aimAngle : this.mouseAimAngle;
  }

  isFiring(): boolean {
    return this.isTouchDevice ? this.aimFiring : this.mouseFiring;
  }

  /** Devuelve el delta de zoom acumulado desde la última llamada y lo resetea. */
  consumeZoomDelta(): number {
    const d = this.zoomAccum;
    this.zoomAccum = 0;
    return d;
  }

  /** Redibuja los joysticks táctiles (llamar una vez por frame). */
  redrawTouchControls() {
    if (!this.touchGraphics) return;
    const g = this.touchGraphics;
    g.clear();

    g.fillStyle(0x8ce3ff, 0.12);
    g.lineStyle(2, 0x8ce3ff, 0.4);
    g.fillCircle(this.moveAnchor.x, this.moveAnchor.y, JOYSTICK_RADIUS);
    g.strokeCircle(this.moveAnchor.x, this.moveAnchor.y, JOYSTICK_RADIUS);
    g.fillStyle(0x8ce3ff, 0.35);
    g.fillCircle(
      this.moveAnchor.x + this.moveKnobOffset.x,
      this.moveAnchor.y + this.moveKnobOffset.y,
      26
    );

    const aimColor = this.aimFiring ? 0xff6b6b : 0x8ce3ff;
    g.fillStyle(aimColor, 0.12);
    g.lineStyle(2, aimColor, 0.4);
    g.fillCircle(this.aimAnchor.x, this.aimAnchor.y, JOYSTICK_RADIUS);
    g.strokeCircle(this.aimAnchor.x, this.aimAnchor.y, JOYSTICK_RADIUS);
    g.fillStyle(aimColor, 0.4);
    g.fillCircle(
      this.aimAnchor.x + this.aimKnobOffset.x,
      this.aimAnchor.y + this.aimKnobOffset.y,
      26
    );
  }
}
