/**
 * Catálogo de sprites de planetas disponibles.
 *
 * `discFraction` = diámetro real de la esfera visible / ancho de la imagen.
 * Se midió por imagen (algunas tienen glow o anillos que exceden el disco,
 * como planet_19) para poder escalar cada sprite con precisión a partir de
 * `CelestialBodyConfig.radius`, sin que el glow/anillo se cuente como parte
 * del tamaño físico del planeta.
 */
export interface PlanetSpriteInfo {
  key: string;
  discFraction: number;
  /** Descripción libre, útil para elegir a mano un tipo de planeta */
  label: string;
  /** Clase de tamaño relativo, usada por el generador procedural para elegir
   * un sprite acorde al radio que le tocó al planeta (los gigantes gaseosos
   * quedan reservados para radios grandes, los rocosos/lunas para chicos). */
  sizeClass: "small" | "medium" | "large";
}

export const PLANET_CATALOG: PlanetSpriteInfo[] = [
  { key: "planet_18", discFraction: 0.923, label: "gigante gaseoso azul/verde con tormenta", sizeClass: "large" },
  { key: "planet_19", discFraction: 0.567, label: "gigante gaseoso verde con anillos", sizeClass: "large" },
  { key: "planet_20", discFraction: 0.922, label: "rocoso claroscuro (terminador)", sizeClass: "small" },
  { key: "planet_21", discFraction: 0.968, label: "oceánico azul/verde con nubes", sizeClass: "medium" },
  { key: "planet_22", discFraction: 0.936, label: "oceánico azul/verde grande", sizeClass: "medium" },
  { key: "planet_23", discFraction: 0.933, label: "árido amarillento (terminador)", sizeClass: "small" },
  { key: "planet_24", discFraction: 0.943, label: "luna rocosa pequeña con cráteres", sizeClass: "small" },
  { key: "planet_25", discFraction: 0.944, label: "luna rocosa pequeña con cráteres", sizeClass: "small" },
  { key: "planet_26", discFraction: 0.936, label: "helado azul con remolinos", sizeClass: "medium" },
  { key: "planet_27", discFraction: 0.947, label: "tipo Tierra, continentes marrones", sizeClass: "medium" },
  { key: "planet_28", discFraction: 0.9, label: "volcánico rojo/naranja (terminador)", sizeClass: "small" },
  { key: "planet_29", discFraction: 0.921, label: "volcánico rojo oscuro (terminador)", sizeClass: "small" },
  { key: "planet_30", discFraction: 0.946, label: "árido nublado amarillo/tostado", sizeClass: "medium" },
  { key: "planet_31", discFraction: 0.952, label: "verde/azul con remolinos", sizeClass: "medium" },
  { key: "planet_32", discFraction: 0.954, label: "tipo Tierra, lado oscuro", sizeClass: "medium" },
  { key: "planet_33", discFraction: 0.955, label: "rocoso claroscuro pequeño", sizeClass: "small" },
];

export function getPlanetSprite(key: string): PlanetSpriteInfo {
  const info = PLANET_CATALOG.find((p) => p.key === key);
  if (!info) throw new Error(`Sprite de planeta desconocido: ${key}`);
  return info;
}

export function getPlanetSpritesByClass(sizeClass: PlanetSpriteInfo["sizeClass"]): PlanetSpriteInfo[] {
  return PLANET_CATALOG.filter((p) => p.sizeClass === sizeClass);
}
