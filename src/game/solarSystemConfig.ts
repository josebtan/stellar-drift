import { getPlanetSprite } from "./planetCatalog";

export interface PlanetDefinition {
  spriteKey: string;
  /** Distancia orbital fija al sol (centro del sistema) */
  orbitDistance: number;
  /** Radio visual del disco del planeta (más chico que el sol, más grande que un asteroide) */
  radius: number;
  /** Masa "de juego" usada por GravitySystem — a mayor masa, más desvía trayectorias */
  mass: number;
  /** Radio de influencia gravitacional (más allá de esto, se ignora su gravedad) */
  influenceRadius: number;
}

/**
 * Constante que fija qué tan rápido orbita un planeta a una distancia de
 * referencia. El resto se deriva con una aproximación a la 3ª ley de Kepler
 * (T² ∝ r³ → velocidad angular ∝ r^-1.5), para que los planetas lejanos
 * orbiten visiblemente más lento que los cercanos, como en un sistema real.
 */
const REFERENCE_DISTANCE = 700;
const REFERENCE_ANGULAR_SPEED = 0.05; // rad/s a REFERENCE_DISTANCE
const KEPLER_K = REFERENCE_ANGULAR_SPEED * Math.pow(REFERENCE_DISTANCE, 1.5);

export function orbitSpeedForDistance(distance: number): number {
  return KEPLER_K / Math.pow(distance, 1.5);
}

// Un sistema solar de 7 planetas variados a partir de los sprites disponibles.
// Radios y masas crecen para los "gigantes gaseosos" (planet_18, planet_19)
// y se mantienen chicos para los rocosos, similar a nuestro sistema solar.
export const PLANET_DEFINITIONS: PlanetDefinition[] = [
  { spriteKey: "planet_24", orbitDistance: 700, radius: 32, mass: 22, influenceRadius: 380 },
  { spriteKey: "planet_28", orbitDistance: 1050, radius: 42, mass: 32, influenceRadius: 460 },
  { spriteKey: "planet_27", orbitDistance: 1500, radius: 50, mass: 40, influenceRadius: 550 },
  { spriteKey: "planet_23", orbitDistance: 2050, radius: 40, mass: 30, influenceRadius: 440 },
  { spriteKey: "planet_18", orbitDistance: 3100, radius: 95, mass: 150, influenceRadius: 950 },
  { spriteKey: "planet_19", orbitDistance: 4300, radius: 78, mass: 110, influenceRadius: 820 },
  { spriteKey: "planet_26", orbitDistance: 5500, radius: 58, mass: 55, influenceRadius: 600 },
];

/** Valida en tiempo de import que todos los sprites referenciados existen en el catálogo */
PLANET_DEFINITIONS.forEach((def) => getPlanetSprite(def.spriteKey));
