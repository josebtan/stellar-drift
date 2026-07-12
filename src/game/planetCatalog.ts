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
}

export const PLANET_CATALOG: PlanetSpriteInfo[] = [
  { key: "planet_18", discFraction: 0.923, label: "gigante gaseoso azul/verde con tormenta" },
  { key: "planet_19", discFraction: 0.567, label: "gigante gaseoso verde con anillos" },
  { key: "planet_20", discFraction: 0.922, label: "rocoso claroscuro (terminador)" },
  { key: "planet_21", discFraction: 0.968, label: "oceánico azul/verde con nubes" },
  { key: "planet_22", discFraction: 0.936, label: "oceánico azul/verde grande" },
  { key: "planet_23", discFraction: 0.933, label: "árido amarillento (terminador)" },
  { key: "planet_24", discFraction: 0.943, label: "luna rocosa pequeña con cráteres" },
  { key: "planet_25", discFraction: 0.944, label: "luna rocosa pequeña con cráteres" },
  { key: "planet_26", discFraction: 0.936, label: "helado azul con remolinos" },
  { key: "planet_27", discFraction: 0.947, label: "tipo Tierra, continentes marrones" },
  { key: "planet_28", discFraction: 0.9, label: "volcánico rojo/naranja (terminador)" },
  { key: "planet_29", discFraction: 0.921, label: "volcánico rojo oscuro (terminador)" },
  { key: "planet_30", discFraction: 0.946, label: "árido nublado amarillo/tostado" },
  { key: "planet_31", discFraction: 0.952, label: "verde/azul con remolinos" },
  { key: "planet_32", discFraction: 0.954, label: "tipo Tierra, lado oscuro" },
  { key: "planet_33", discFraction: 0.955, label: "rocoso claroscuro pequeño" },
];

export function getPlanetSprite(key: string): PlanetSpriteInfo {
  const info = PLANET_CATALOG.find((p) => p.key === key);
  if (!info) throw new Error(`Sprite de planeta desconocido: ${key}`);
  return info;
}
