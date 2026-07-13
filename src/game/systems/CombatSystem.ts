import Phaser from "phaser";
import { GravitySystem } from "../physics/GravitySystem";
import { CelestialBody } from "../entities/CelestialBody";
import { Asteroid } from "../entities/Asteroid";
import { Projectile, PROJECTILE_RADIUS, PROJECTILE_DAMAGE } from "../entities/Projectile";
import { ResourcePickup, PICKUP_RADIUS } from "../entities/ResourcePickup";
import { PlayerShip } from "../entities/PlayerShip";
import { Inventory } from "./Inventory";

export interface CombatCallbacks {
  onAsteroidDestroyed: (asteroid: Asteroid) => void;
}

/**
 * Maneja el ciclo completo de disparo: proyectiles en vuelo, impacto contra
 * asteroides/astros, generación de minerales flotantes al destruir un
 * asteroide a tiros, y su recolección automática al pasar la nave por
 * encima. No depende de sectores (los proyectiles/pickups son de vida
 * corta, así que no hace falta streaming para ellos).
 */
export class CombatSystem {
  private scene: Phaser.Scene;
  private gravity: GravitySystem;
  private projectiles: Projectile[] = [];
  private pickups: ResourcePickup[] = [];

  constructor(scene: Phaser.Scene, gravity: GravitySystem) {
    this.scene = scene;
    this.gravity = gravity;
  }

  fire(x: number, y: number, angle: number) {
    this.projectiles.push(new Projectile(this.scene, x, y, angle));
  }

  update(
    dt: number,
    celestialBodies: readonly CelestialBody[],
    asteroids: readonly Asteroid[],
    ship: PlayerShip,
    inventory: Inventory,
    callbacks: CombatCallbacks
  ) {
    this.updateProjectiles(dt, celestialBodies, asteroids, callbacks);
    this.updatePickups(dt, ship, inventory);
  }

  private updateProjectiles(
    dt: number,
    celestialBodies: readonly CelestialBody[],
    asteroids: readonly Asteroid[],
    callbacks: CombatCallbacks
  ) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const alive = p.update(dt);
      if (!alive) {
        p.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      let hit = false;

      for (const body of celestialBodies) {
        const dist = Phaser.Math.Distance.Between(p.x, p.y, body.x, body.y);
        if (dist <= body.config.radius + PROJECTILE_RADIUS) {
          hit = true;
          break;
        }
      }

      if (!hit) {
        for (const asteroid of asteroids) {
          if (!asteroid.active) continue;
          const dist = Phaser.Math.Distance.Between(p.x, p.y, asteroid.x, asteroid.y);
          if (dist <= asteroid.radius + PROJECTILE_RADIUS) {
            hit = true;
            const destroyed = asteroid.takeDamage(PROJECTILE_DAMAGE);
            if (destroyed) {
              this.spawnPickups(asteroid);
              callbacks.onAsteroidDestroyed(asteroid);
            }
            break;
          }
        }
      }

      if (hit) {
        p.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number, ship: PlayerShip, inventory: Inventory) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      this.gravity.step(pickup, dt);
      const alive = pickup.applyVelocity(dt);
      if (!alive) {
        pickup.destroy();
        this.pickups.splice(i, 1);
        continue;
      }

      if (!ship.isDestroyed) {
        const dist = Phaser.Math.Distance.Between(ship.x, ship.y, pickup.x, pickup.y);
        if (dist <= PICKUP_RADIUS + PlayerShip.COLLISION_RADIUS) {
          inventory.add(pickup.resourceType, pickup.amount);
          pickup.destroy();
          this.pickups.splice(i, 1);
        }
      }
    }
  }

  private spawnPickups(asteroid: Asteroid) {
    const count = Phaser.Math.Between(3, 6);
    const perPickup = asteroid.resourceAmount / count;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(15, 60);
      const offset = Phaser.Math.FloatBetween(0, asteroid.radius);
      const x = asteroid.x + Math.cos(angle) * offset;
      const y = asteroid.y + Math.sin(angle) * offset;
      const vx = Math.cos(angle) * speed + asteroid.vx * 0.4;
      const vy = Math.sin(angle) * speed + asteroid.vy * 0.4;
      this.pickups.push(
        new ResourcePickup(this.scene, x, y, asteroid.resourceType, perPickup, vx, vy)
      );
    }
  }
}
