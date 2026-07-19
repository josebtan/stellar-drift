import Phaser from "phaser";

/**
 * Tamaño de referencia para el que está pensado el HUD (equivale a
 * escala 1, el tamaño "de diseño" que ya existía en desktop). Por debajo
 * de eso todo el HUD (barras, inventario, minimapa, joysticks, botón de
 * emergencia, power-ups) se reduce proporcionalmente para entrar sin
 * solaparse en pantallas de celular, tanto en vertical como en horizontal.
 */
const REFERENCE_WIDTH = 960;
const REFERENCE_HEIGHT = 600;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1;

/**
 * Factor de escala del HUD según el tamaño actual del viewport. Toma el
 * lado más restrictivo (ancho o alto) para que un celular angosto Y uno
 * bajo (horizontal) escalen igual de bien. Se recalcula en cada resize,
 * así que un cambio de orientación lo actualiza automáticamente.
 */
export function getUiScale(scene: Phaser.Scene): number {
  const { width, height } = scene.scale;
  const scale = Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT);
  return Phaser.Math.Clamp(scale, MIN_SCALE, MAX_SCALE);
}
