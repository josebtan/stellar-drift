import type { ResourceType } from "../entities/Asteroid";

const DEFAULT_CARGO_CAPACITY = 500;
const DEFAULT_FUEL_CAPACITY = 100;
const DEFAULT_OXYGEN_CAPACITY = 100;
const STARTING_CREDITS = 150;

/**
 * Inventario y economía de la nave: recursos recolectados (con espacio de
 * carga limitado), combustible (se gasta al impulsarse), oxígeno/soporte
 * vital (baja con el tiempo, se repone con hielo o comprando en la
 * estación) y créditos. Las capacidades (cargo/combustible/oxígeno) son
 * mejorables — comprando upgrades en la estación — y persisten aunque la
 * nave se destruya; lo que se pierde al morir es la carga sin vender.
 */
export class Inventory {
  private resources: Record<ResourceType, number> = {
    iron: 0,
    ice: 0,
    rareMineral: 0,
  };

  credits = STARTING_CREDITS;

  cargoCapacity = DEFAULT_CARGO_CAPACITY;
  fuelCapacity = DEFAULT_FUEL_CAPACITY;
  oxygenCapacity = DEFAULT_OXYGEN_CAPACITY;

  fuel = DEFAULT_FUEL_CAPACITY;
  /** Oxígeno/soporte vital, 0-oxygenCapacity. Baja con el tiempo, se repone
   * automáticamente consumiendo "ice" recolectado, o comprando en la estación. */
  oxygen = DEFAULT_OXYGEN_CAPACITY;

  get totalCargoUsed() {
    return this.resources.iron + this.resources.ice + this.resources.rareMineral;
  }

  get isCargoFull() {
    return this.totalCargoUsed >= this.cargoCapacity - 0.001;
  }

  get cargoFraction() {
    return this.cargoCapacity > 0 ? this.totalCargoUsed / this.cargoCapacity : 0;
  }

  /** Añade recurso respetando el límite de carga. Devuelve lo que realmente entró. */
  add(type: ResourceType, amount: number): number {
    const free = this.cargoCapacity - this.totalCargoUsed;
    const added = Math.max(0, Math.min(amount, free));
    this.resources[type] += added;
    return added;
  }

  get(type: ResourceType) {
    return this.resources[type];
  }

  getAll() {
    return { ...this.resources };
  }

  /** Vende todo el recurso de un tipo al precio dado. Devuelve los créditos ganados. */
  sellAll(type: ResourceType, pricePerUnit: number): number {
    const amount = this.resources[type];
    if (amount <= 0) return 0;
    this.resources[type] = 0;
    const earned = amount * pricePerUnit;
    this.credits += earned;
    return earned;
  }

  spendCredits(amount: number): boolean {
    if (this.credits < amount) return false;
    this.credits -= amount;
    return true;
  }

  get hasFuel() {
    return this.fuel > 0;
  }

  consumeFuel(amount: number) {
    this.fuel = Math.max(0, this.fuel - amount);
  }

  refuel(amount: number) {
    this.fuel = Math.min(this.fuelCapacity, this.fuel + amount);
  }

  refillOxygen(amount: number) {
    this.oxygen = Math.min(this.oxygenCapacity, this.oxygen + amount);
  }

  upgradeCargoCapacity(amount: number) {
    this.cargoCapacity += amount;
  }

  upgradeFuelCapacity(amount: number) {
    this.fuelCapacity += amount;
    this.fuel += amount; // el tanque nuevo viene cargado
  }

  upgradeOxygenCapacity(amount: number) {
    this.oxygenCapacity += amount;
    this.oxygen += amount;
  }

  /** Debe llamarse cada frame/tick. Consume oxígeno y repone con hielo disponible. */
  tickLifeSupport(dt: number) {
    const DECAY_PER_SEC = 0.15;
    this.oxygen = Math.max(0, this.oxygen - DECAY_PER_SEC * dt);

    if (this.oxygen < this.oxygenCapacity * 0.4 && this.resources.ice > 0) {
      const consume = Math.min(this.resources.ice, dt * 2);
      this.resources.ice -= consume;
      this.oxygen = Math.min(this.oxygenCapacity, this.oxygen + consume * 5);
    }
  }

  /**
   * Usado al respawnear tras destruir la nave: se pierde la carga sin
   * vender, pero los créditos y las capacidades (upgrades comprados)
   * persisten — solo el combustible/oxígeno se recargan a full.
   */
  reset() {
    this.resources = { iron: 0, ice: 0, rareMineral: 0 };
    this.fuel = this.fuelCapacity;
    this.oxygen = this.oxygenCapacity;
  }
}
