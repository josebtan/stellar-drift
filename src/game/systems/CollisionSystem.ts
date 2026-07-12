import Phaser from "phaser";
import type { CelestialBody } from "../entities/CelestialBody";
import type { Asteroid } from "../entities/Asteroid";
import { PlayerShip } from "../entities/PlayerShip";

/** Daño de casco al chocar la nave contra un asteroide, según su tamaño. */
function shipImpactDamage(asteroidRadius: number): number {
  return Phaser.Math.Clamp(asteroidRadius * 0.9, 8, 45);
}

export interface CollisionCallbacks {
  onAsteroidDestroyed: (asteroid: Asteroid) => void;
  onShipDestroyed: () => void;
}

/**
 * Revisa colisiones por distancia (no usa arcade physics: los cuerpos ya
 * tienen su propia integración vía GravitySystem). O(cuerpos × asteroides)
 * por frame — con las cantidades actuales (decenas de cuerpos, un par de
 * cientos de asteroides cargados) es holgadamente barato; si el universo
 * cargado crece mucho, esto es lo primero a optimizar con un grid espacial.
 */
export function checkCollisions(
  ship: PlayerShip,
  celestialBodies: readonly CelestialBody[],
  asteroids: readonly Asteroid[],
  callbacks: CollisionCallbacks
) {
  // Asteroides vs estrellas/planetas: el asteroide se destruye al impactar.
  // Se recorre de atrás hacia adelante porque onAsteroidDestroyed puede
  // mutar la lista que nos pasaron si el caller la comparte por referencia.
  for (const body of celestialBodies) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (!asteroid.active) continue;
      const dist = Phaser.Math.Distance.Between(body.x, body.y, asteroid.x, asteroid.y);
      if (dist <= body.config.radius + asteroid.radius) {
        asteroid.destroy();
        callbacks.onAsteroidDestroyed(asteroid);
      }
    }
  }

  if (!ship.isDestroyed) {
    // Nave vs estrellas/planetas: destrucción inmediata (no hay forma de
    // sobrevivir a un impacto contra un astro de ese tamaño/masa).
    for (const body of celestialBodies) {
      const dist = Phaser.Math.Distance.Between(body.x, body.y, ship.x, ship.y);
      if (dist <= body.config.radius + PlayerShip.COLLISION_RADIUS) {
        ship.destroyShip();
        callbacks.onShipDestroyed();
        return; // ya está destruida, no tiene sentido seguir revisando
      }
    }

    // Nave vs asteroides: daño de casco, no destrucción instantánea. El
    // asteroide impactado también se destruye (fue un choque, no minería).
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (!asteroid.active) continue;
      const dist = Phaser.Math.Distance.Between(ship.x, ship.y, asteroid.x, asteroid.y);
      if (dist <= asteroid.radius + PlayerShip.COLLISION_RADIUS) {
        const damaged = ship.takeDamage(shipImpactDamage(asteroid.radius));
        if (damaged) {
          asteroid.destroy();
          callbacks.onAsteroidDestroyed(asteroid);
          if (ship.isDestroyed) {
            callbacks.onShipDestroyed();
            return;
          }
        }
      }
    }
  }
}
