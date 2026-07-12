# Stellar Drift

Juego web de exploración espacial. El jugador controla una nave que viaja por
el espacio recolectando recursos de asteroides, sorteando la atracción
gravitacional de estrellas y planetas, para sobrevivir (soporte vital) y
comerciar en puntos de venta.

## Estado actual del proyecto

🚧 **MVP en desarrollo — single player.** El multijugador llegará en una
fase posterior sobre una capa de red desacoplada del core del juego.

### Implementado
- Motor: Phaser 3 + TypeScript + Vite.
- Sistema de gravedad orbital simplificado (`GravitySystem`): cuerpos
  masivos (estrellas/planetas) con radio de influencia, que atraen a
  cuerpos ligeros (nave, asteroides) sin costo O(n²).
- Cuerpo celeste (estrella) + planeta en órbita kepleriana simple.
- Nave controlable (rotación + empuje) afectada por la gravedad.
- Cámara centrada en la nave (`camera.startFollow`).
- Campo de asteroides con recursos minables (hierro, hielo, mineral raro).
- Minería básica (tecla `ESPACIO` sobre el asteroide más cercano).
- Inventario con capacidad limitada y soporte vital que se consume con el
  tiempo y se repone con hielo.
- Login/registro con Firebase Auth + estado de jugador persistido en
  Firestore (posición, recursos, soporte vital, créditos).

### Pendiente / roadmap
- Puntos de venta / comercio con precios dinámicos por estación.
- HUD y UI pulida (actualmente texto plano).
- Guardado periódico de `PlayerState` durante la partida (throttle).
- Multijugador (evaluando Colyseus para salas + estado sincronizado).
- Assets propios (sprites de nave, estaciones, fondos) — hoy todo es
  gráficos vectoriales para iterar mecánicas rápido.
- Sistema de daño/colisiones con cuerpos celestes y otras naves.
- Balanceo de física (masas, velocidades, radios de influencia).

## Arquitectura

```
src/
  game/
    config.ts          # Configuración de Phaser (escenas, physics)
    scenes/
      BootScene.ts      # Precarga (vacía por ahora, sin assets)
      MainScene.ts       # Escena principal: cámara, mundo, loop de juego
    entities/
      PlayerShip.ts       # Nave del jugador (input + LightBody)
      Asteroid.ts          # Asteroide minable (LightBody)
      CelestialBody.ts      # Estrella/planeta (MassiveBody, con órbita propia)
    physics/
      GravitySystem.ts       # Cálculo de gravedad tipo "sphere of influence"
    systems/
      Inventory.ts             # Recursos + soporte vital del jugador
  services/
    firebase.ts    # Inicialización del SDK de Firebase
    auth.ts          # Login / registro / logout
    playerState.ts     # Persistencia de estado del jugador en Firestore
  ui/
    AuthScreen.ts   # Pantalla de login/registro (overlay DOM sobre el canvas)
```

### Modelo de gravedad

En vez de un N-body completo (O(n²), costoso e inestable para gameplay),
usamos un modelo híbrido:
- **Cuerpos masivos** (estrellas, planetas): posición fija o en órbita
  kepleriana precalculada. No son afectados por gravedad de otros cuerpos.
- **Cuerpos ligeros** (nave, asteroides): se ven atraídos por cada cuerpo
  masivo dentro de su `influenceRadius`. Integración semi-implícita
  (Euler-Cromer) para estabilidad de órbitas.

Esto da trayectorias curvas creíbles (slingshots, desvíos, órbitas) con
costo de cálculo predecible.

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con credenciales de un proyecto Firebase
npm run dev
```

### Variables de entorno

Ver `.env.example`. Se necesita un proyecto de Firebase con **Authentication
(Email/Password)** y **Firestore** habilitados.

## Scripts

- `npm run dev` — servidor de desarrollo con hot reload.
- `npm run build` — build de producción (`tsc` + `vite build`).
- `npm run preview` — sirve el build de producción localmente.

## Controles (MVP)

- `↑` / `W`: empuje
- `←` `→` / `A` `D`: rotar
- `ESPACIO`: minar el asteroide más cercano dentro de rango

## Stack

- [Phaser 3](https://phaser.io/) — motor de juego
- [Vite](https://vitejs.dev/) — build tool
- TypeScript
- [Firebase](https://firebase.google.com/) — Auth + Firestore (login,
  registro y estado persistente del jugador)
