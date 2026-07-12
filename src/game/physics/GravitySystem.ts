/**
 * GravitySystem
 * ------------------------------------------------------------
 * Modelo simplificado de gravedad tipo N-body "híbrido":
 * - Los CelestialBody (estrellas/planetas) son cuerpos MASIVOS con
 *   posición fija o en órbita kepleriana precalculada. No se ven
 *   afectados por la gravedad de otros cuerpos ligeros.
 * - Los cuerpos LIGEROS (nave, asteroides) son atraídos por todos
 *   los cuerpos masivos dentro de su "sphere of influence" (radio
 *   de influencia), evitando calcular fuerzas entre todos los
 *   objetos ligeros entre sí (que sería O(n^2) e innecesario
 *   para el gameplay).
 *
 * Esto da trayectorias curvas creíbles (slingshot, órbitas,
 * desvíos) sin el costo ni el caos de un N-body completo.
 * ------------------------------------------------------------
 */

export interface MassiveBody {
  x: number;
  y: number;
  mass: number;
  /** Radio a partir del cual se ignora su gravedad (optimización) */
  influenceRadius: number;
}

export interface LightBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Constante gravitacional "de juego" (no la real, se ajusta a la escala del mundo)
export const G = 6000;

export class GravitySystem {
  private massiveBodies: MassiveBody[] = [];

  registerMassiveBody(body: MassiveBody) {
    this.massiveBodies.push(body);
  }

  clear() {
    this.massiveBodies = [];
  }

  /**
   * Calcula la aceleración neta (ax, ay) sobre un cuerpo ligero
   * sumando la atracción de cada cuerpo masivo dentro de rango.
   */
  getAcceleration(body: LightBody): { ax: number; ay: number } {
    let ax = 0;
    let ay = 0;

    for (const massive of this.massiveBodies) {
      const dx = massive.x - body.x;
      const dy = massive.y - body.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist === 0 || dist > massive.influenceRadius) continue;

      // Evita singularidad/fuerzas absurdas muy cerca del centro de masa
      const safeDistSq = Math.max(distSq, 400);
      const forceMagnitude = (G * massive.mass) / safeDistSq;

      ax += (dx / dist) * forceMagnitude;
      ay += (dy / dist) * forceMagnitude;
    }

    return { ax, ay };
  }

  /**
   * Integra la velocidad/posición de un cuerpo ligero un paso de tiempo dt (segundos).
   * Usa integración semi-implícita (Euler-Cromer) por estabilidad en órbitas.
   */
  step(body: LightBody, dt: number) {
    const { ax, ay } = this.getAcceleration(body);
    body.vx += ax * dt;
    body.vy += ay * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
}
