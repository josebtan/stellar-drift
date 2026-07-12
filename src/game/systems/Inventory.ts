import type { ResourceType } from "../entities/Asteroid";

const CAPACITY = 500;

/**
 * Inventario del jugador. Responsable de recursos recolectados
 * y del consumo de soporte vital (a partir de "ice"/agua).
 */
export class Inventory {
  private resources: Record<ResourceType, number> = {
    iron: 0,
    ice: 0,
    rareMineral: 0,
  };

  /** Soporte vital, 0-100. Baja con el tiempo, se repone consumiendo "ice". */
  lifeSupport = 100;

  get totalUnits() {
    return this.resources.iron + this.resources.ice + this.resources.rareMineral;
  }

  add(type: ResourceType, amount: number): number {
    const free = CAPACITY - this.totalUnits;
    const added = Math.min(amount, free);
    this.resources[type] += added;
    return added;
  }

  get(type: ResourceType) {
    return this.resources[type];
  }

  getAll() {
    return { ...this.resources };
  }

  /** Debe llamarse cada frame/tick. Consume vida y repone con hielo disponible. */
  tickLifeSupport(dt: number) {
    const DECAY_PER_SEC = 0.15;
    this.lifeSupport = Math.max(0, this.lifeSupport - DECAY_PER_SEC * dt);

    if (this.lifeSupport < 40 && this.resources.ice > 0) {
      const consume = Math.min(this.resources.ice, dt * 2);
      this.resources.ice -= consume;
      this.lifeSupport = Math.min(100, this.lifeSupport + consume * 5);
    }
  }
}
