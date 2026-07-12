export const SUN_FRAME_SIZE = 330;
export const SUN_FRAME_COUNT = 15;

export const ASTEROID_FRAME_SIZE = 220;
/** 9 modelos de asteroide DISTINTOS (no frames de una animación) — variedad
 * de formas/tamaños. Cada índice es un modelo distinto en el spritesheet. */
export const ASTEROID_MODEL_COUNT = 9;
/** Fracción del frame ocupada por cada modelo (medida por separado, ya que
 * al ser formas irregulares distintas, varían bastante entre sí: 0.66-0.99). */
export const ASTEROID_MODEL_DISC_FRACTIONS = [
  0.8875, 0.6562, 0.9988, 0.9525, 0.9475, 0.8525, 0.9113, 0.95, 0.8413,
];
