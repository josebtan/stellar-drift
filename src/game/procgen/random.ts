/**
 * PRNG determinista (mulberry32). A igual semilla, siempre produce la misma
 * secuencia — esencial para que un sector del universo se genere idéntico
 * cada vez que el jugador entra/sale de su radio de carga, sin tener que
 * guardar su contenido en ningún lado.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BIT_NOISE1 = 0xb5297a4d;
const BIT_NOISE2 = 0x68e31da4;
const BIT_NOISE3 = 0x1b56c4e9;
const LARGE_PRIME = 198491317; // primo "sin patrones aburridos" (Squirrel Eiserloh, GDC 2017)

/**
 * "Squirrel3" noise (Squirrel Eiserloh, GDC 2017): hash de un entero con
 * buena avalancha de bits, muy usado en generación procedural determinista.
 * Para 2D, se combinan x e y en un único entero (x + PRIME*y) antes de
 * hashear, tal como lo describe la charla original — un simple XOR+multiply
 * ingenuo colisionaba: sectores como (-2,0) y (0,-2) generaban el mismo
 * sistema con la implementación anterior.
 */
function squirrel3(positionX: number, seed: number): number {
  let mangled = Math.imul(positionX | 0, BIT_NOISE1);
  mangled = (mangled + seed) | 0;
  mangled ^= mangled >>> 8;
  mangled = (mangled + BIT_NOISE2) | 0;
  mangled ^= mangled << 8;
  mangled = Math.imul(mangled, BIT_NOISE3);
  mangled ^= mangled >>> 8;
  return mangled >>> 0;
}

/** Combina dos enteros (ej. coordenadas de sector) en una única semilla estable. */
export function hashCoords(x: number, y: number, salt = 0): number {
  const combined = (x + LARGE_PRIME * y) | 0;
  return squirrel3(combined, salt) >>> 0;
}

export class SeededRandom {
  private rand: () => number;

  constructor(seed: number) {
    this.rand = mulberry32(seed);
  }

  next(): number {
    return this.rand();
  }

  range(min: number, max: number): number {
    return min + this.rand() * (max - min);
  }

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rand() * items.length)];
  }

  chance(probability: number): boolean {
    return this.rand() < probability;
  }
}
