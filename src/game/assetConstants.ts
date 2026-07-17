export const SUN_FRAME_WIDTH = 330;
export const SUN_FRAME_HEIGHT = 330;
export const SUN_FRAME_COUNT = 15;
export const SUN_DISC_FRACTION = 0.66;

export const ASTEROID_FRAME_SIZE = 220;
/** 9 modelos de asteroide DISTINTOS (no frames de una animación) — variedad
 * de formas/tamaños. Cada índice es un modelo distinto en el spritesheet. */
export const ASTEROID_MODEL_COUNT = 9;
/** Fracción del frame ocupada por cada modelo (medida por separado, ya que
 * al ser formas irregulares distintas, varían bastante entre sí: 0.66-0.99). */
export const ASTEROID_MODEL_DISC_FRACTIONS = [
  0.8875, 0.6562, 0.9988, 0.9525, 0.9475, 0.8525, 0.9113, 0.95, 0.8413,
];

/**
 * Geometría del "agujero" de relleno en las barras de estado (combustible/
 * energía/oxígeno) — las 3 imágenes comparten el mismo layout exacto. El
 * agujero ya viene recortado con alpha=0 real en el PNG (no hace falta
 * chroma-key); solo necesitamos saber dónde está para dibujar el relleno
 * de color dinámico justo detrás, en la posición y tamaño correctos.
 */
export const BAR_IMAGE_WIDTH = 838;
export const BAR_IMAGE_HEIGHT = 140;
export const BAR_HOLE_X = 170;
export const BAR_HOLE_Y = 90;
export const BAR_HOLE_WIDTH = 560;
export const BAR_HOLE_HEIGHT = 18;

export const SHIELD_BURST_FRAME_SIZE = 100;
export const SHIELD_BURST_FRAME_COUNT = 8;

/**
 * Geometría del sprite de botón de emergencia (aviso de combustible en 0).
 * Medida sobre el PNG original (785x705). Las 8 luces son huecos con
 * alpha=0 real repartidos por el marco; el panel de texto es el hueco
 * rectangular oscuro (opaco, no transparente) en la parte inferior donde
 * va superpuesto el texto "Emergencia".
 */
export const EMERGENCY_IMAGE_WIDTH = 290;
export const EMERGENCY_IMAGE_HEIGHT = 260;
export const EMERGENCY_LIGHT_RADIUS = 2.6;
export const EMERGENCY_LIGHT_CENTERS = [
  { x: 109.6, y: 17.7 },
  { x: 180.0, y: 17.7 },
  { x: 144.9, y: 28.4 },
  { x: 32.1, y: 76.7 },
  { x: 257.1, y: 76.3 },
  { x: 38.7, y: 202.8 },
  { x: 248.9, y: 202.8 },
  { x: 144.9, y: 238.6 },
];
export const EMERGENCY_TEXT_CENTER = { x: 144.9, y: 205.8 };
export const EMERGENCY_TEXT_MAX_WIDTH = 169.6;
