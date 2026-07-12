import { SeededRandom, hashCoords } from "./random";
import { getPlanetSpritesByClass } from "../planetCatalog";
import { G } from "../physics/GravitySystem";
import type { ResourceType } from "../entities/Asteroid";

/** Semilla global del universo. Cambiarla genera un universo completamente distinto. */
export const UNIVERSE_SEED = 20260712;

/** Tamaño de cada celda del grid procedural. Las estrellas se ubican dentro
 * de su sector con jitter, nunca más cerca entre sí que SECTOR_SIZE menos
 * el jitter máximo — así quedan "lo suficientemente alejadas" sin necesidad
 * de guardar posiciones a mano. */
export const SECTOR_SIZE = 14000;
const STAR_JITTER = 3000; // desplazamiento máx. del sol respecto al centro del sector
const STAR_SPAWN_CHANCE = 0.55; // probabilidad de que un sector tenga estrella
/** Tope duro para el radio de un sistema (última órbita), pensado para que,
 * incluso en el peor caso de jitter entre dos estrellas vecinas, sus
 * sistemas no lleguen a solaparse. */
const MAX_SYSTEM_RADIUS = 5200;

export interface StarDef {
  x: number;
  y: number;
  radius: number;
  mass: number;
  influenceRadius: number;
}

export interface PlanetDef {
  spriteKey: string;
  orbitDistance: number;
  /** Ángulo inicial (rad) respecto al centro de la estrella, para que los
   * planetas no arranquen todos alineados sobre el mismo rayo. */
  orbitAngleOffset: number;
  radius: number;
  mass: number;
  influenceRadius: number;
  orbitSpeed: number; // ya resuelto con física real (ver keplerAngularSpeed)
}

export interface AsteroidDef {
  x: number;
  y: number;
  radius: number;
  resourceType: ResourceType;
  amount: number;
  vx: number;
  vy: number;
}

export interface SectorData {
  sectorX: number;
  sectorY: number;
  star: StarDef | null;
  planets: PlanetDef[];
  asteroids: AsteroidDef[];
}

/**
 * Velocidad angular real para una órbita circular estable, derivada de la
 * ley de gravitación (misma constante G que usa GravitySystem):
 *   ω = sqrt(G · M / r³)
 * A mayor distancia u menor masa del astro central, órbita más lenta —
 * exactamente el comportamiento de la 3ª ley de Kepler, pero calculado
 * directamente de la física del juego en vez de una fórmula aparte.
 */
function keplerAngularSpeed(centralMass: number, distance: number): number {
  return Math.sqrt((G * centralMass) / Math.pow(distance, 3));
}

function sectorSeed(sectorX: number, sectorY: number): number {
  return hashCoords(sectorX, sectorY, UNIVERSE_SEED);
}

/** Genera (de forma determinista) el contenido de un sector del universo. */
export function generateSector(sectorX: number, sectorY: number): SectorData {
  const rng = new SeededRandom(sectorSeed(sectorX, sectorY));

  const sectorCenterX = sectorX * SECTOR_SIZE;
  const sectorCenterY = sectorY * SECTOR_SIZE;

  // El sector de origen (0,0) siempre tiene estrella: es donde arranca el jugador.
  const isOrigin = sectorX === 0 && sectorY === 0;
  const hasStar = isOrigin || rng.chance(STAR_SPAWN_CHANCE);

  if (!hasStar) {
    return {
      sectorX,
      sectorY,
      star: null,
      planets: [],
      asteroids: generateRogueAsteroids(rng, sectorCenterX, sectorCenterY),
    };
  }

  const starX = sectorCenterX + rng.range(-STAR_JITTER, STAR_JITTER);
  const starY = sectorCenterY + rng.range(-STAR_JITTER, STAR_JITTER);
  const starRadius = rng.range(260, 460);
  const starMass = starRadius * rng.range(4.5, 5.5); // masa ligada al tamaño, con variación

  const planetCount = rng.intRange(2, 6);
  const planets: PlanetDef[] = [];

  let cursorDistance = starRadius * rng.range(2.2, 3.2) + rng.range(300, 600);

  for (let i = 0; i < planetCount; i++) {
    if (cursorDistance > MAX_SYSTEM_RADIUS) break; // el sistema ya alcanzó su tope de espacio seguro

    // Los planetas más externos tienden a ser más grandes (como gigantes
    // gaseosos reales más allá de la línea de hielo), con variación.
    const outwardBias = i / Math.max(1, planetCount - 1); // 0 (interior) -> 1 (exterior)
    const baseRadius = 16 + outwardBias * 55;
    const radius = Math.max(14, baseRadius + rng.range(-10, 15));

    // El planeta SIEMPRE debe quedar muy por debajo del tamaño del sol.
    const cappedRadius = Math.min(radius, starRadius * 0.35);

    const sizeClass = cappedRadius > 55 ? "large" : cappedRadius > 32 ? "medium" : "small";
    const candidates = getPlanetSpritesByClass(sizeClass);
    const spriteKey = rng.pick(candidates).key;

    const mass = cappedRadius * cappedRadius * 0.03;
    const influenceRadius = cappedRadius * 10;

    const orbitDistance = cursorDistance;
    const orbitSpeed = keplerAngularSpeed(starMass, orbitDistance);
    const orbitAngleOffset = rng.range(0, Math.PI * 2);

    planets.push({
      spriteKey,
      orbitDistance,
      orbitAngleOffset,
      radius: cappedRadius,
      mass,
      influenceRadius,
      orbitSpeed,
    });

    // Prepara la distancia del próximo planeta, dejando espacio proporcional
    // a los radios para que no se vean superpuestos.
    cursorDistance += cappedRadius * 6 + rng.range(500, 1100);
  }

  const maxOrbit = planets.length > 0 ? planets[planets.length - 1].orbitDistance : starRadius * 3;
  const star: StarDef = {
    x: starX,
    y: starY,
    radius: starRadius,
    mass: starMass,
    influenceRadius: Math.min(maxOrbit + 1500, 6500),
  };

  // Cinturón de asteroides + dispersos, generado en base a la posición real
  // de la estrella y sus planetas.
  const asteroids = generateBelt(rng, star, planets);

  return { sectorX, sectorY, star, planets, asteroids };
}

function generateBelt(rng: SeededRandom, star: StarDef, planets: PlanetDef[]): AsteroidDef[] {
  const types: ResourceType[] = ["iron", "ice", "rareMineral"];
  const asteroids: AsteroidDef[] = [];

  // Cinturón principal: en un hueco entre dos planetas consecutivos (si hay
  // al menos 2), si no, un anillo disperso alrededor del último planeta.
  let beltInner: number;
  let beltOuter: number;
  if (planets.length >= 2) {
    const gapIndex = Math.floor(planets.length / 2);
    beltInner = planets[gapIndex - 1].orbitDistance + planets[gapIndex - 1].radius * 4;
    beltOuter = planets[gapIndex].orbitDistance - planets[gapIndex].radius * 4;
    if (beltOuter <= beltInner) beltOuter = beltInner + 400;
  } else {
    const base = planets.length > 0 ? planets[0].orbitDistance : star.radius * 4;
    beltInner = base + 500;
    beltOuter = base + 1200;
  }

  const beltCount = rng.intRange(18, 40);
  for (let i = 0; i < beltCount; i++) {
    const dist = rng.range(beltInner, beltOuter);
    asteroids.push(spawnAsteroidAt(rng, types, star.x, star.y, dist));
  }

  // Dispersos en el sistema exterior, más allá del último planeta.
  const outerBase = planets.length > 0 ? planets[planets.length - 1].orbitDistance : beltOuter;
  const scatterCount = rng.intRange(5, 14);
  for (let i = 0; i < scatterCount; i++) {
    const dist = rng.range(outerBase + 600, outerBase + 2200);
    asteroids.push(spawnAsteroidAt(rng, types, star.x, star.y, dist));
  }

  return asteroids;
}

function generateRogueAsteroids(rng: SeededRandom, centerX: number, centerY: number): AsteroidDef[] {
  const types: ResourceType[] = ["iron", "ice", "rareMineral"];
  const count = rng.intRange(4, 12);
  const asteroids: AsteroidDef[] = [];
  for (let i = 0; i < count; i++) {
    const x = centerX + rng.range(-SECTOR_SIZE / 2, SECTOR_SIZE / 2);
    const y = centerY + rng.range(-SECTOR_SIZE / 2, SECTOR_SIZE / 2);
    asteroids.push({
      x,
      y,
      radius: rng.range(10, 26),
      resourceType: rng.pick(types),
      amount: rng.range(40, 120),
      vx: rng.range(-15, 15),
      vy: rng.range(-15, 15),
    });
  }
  return asteroids;
}

function spawnAsteroidAt(
  rng: SeededRandom,
  types: readonly ResourceType[],
  cx: number,
  cy: number,
  distance: number
): AsteroidDef {
  const angle = rng.range(0, Math.PI * 2);
  return {
    x: cx + Math.cos(angle) * distance,
    y: cy + Math.sin(angle) * distance,
    radius: rng.range(10, 26),
    resourceType: rng.pick(types),
    amount: rng.range(40, 120),
    vx: rng.range(-15, 15),
    vy: rng.range(-15, 15),
  };
}

export function worldToSector(x: number, y: number): { sx: number; sy: number } {
  return {
    sx: Math.round(x / SECTOR_SIZE),
    sy: Math.round(y / SECTOR_SIZE),
  };
}
