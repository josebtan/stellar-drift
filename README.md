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
- Universo procedural (casi) infinito: sectores generados de forma
  determinista (misma semilla → mismo contenido siempre), con streaming
  de carga/descarga según la posición de la nave.
- Sistema de gravedad orbital simplificado (`GravitySystem`): cuerpos
  masivos (estrellas/planetas) con radio de influencia, que atraen a
  cuerpos ligeros (nave, asteroides, minerales flotantes) sin costo O(n²).
- Velocidad orbital de cada planeta calculada con física real (ω=√(G·M/r³)).
- Nave controlable (PC: mouse+teclado; móvil: joysticks táctiles),
  siempre centrada en pantalla, con zoom in/out.
- Sistema de disparo: la nave dispara proyectiles a los asteroides; al
  destruirlos sueltan minerales flotantes que se recolectan pasando por
  encima.
- Sistema de colisiones: asteroide vs estrella/planeta se destruye;
  nave vs estrella/planeta se destruye; nave vs asteroide recibe daño
  de casco (con invulnerabilidad breve tras el golpe).
- Pantalla de "nave destruida" con respawn (reinicia inventario).
- Minimapa con nave centrada, astros y asteroides cercanos.
- Inventario con capacidad limitada y soporte vital que se consume con el
  tiempo y se repone con hielo.
- Login/registro con Firebase Auth + estado de jugador persistido en
  Firestore (posición, recursos, soporte vital, créditos).
- Botón de emergencia (aparece con combustible en 0) que contrata una
  nave de auxilio a cambio de créditos: llega desde fuera de pantalla,
  se estaciona junto al jugador, recarga el tanque rápido y se retira.
- Interfaz responsiva: el HUD entero (barras, inventario, minimapa,
  joysticks táctiles, botón de emergencia) se reescala dinámicamente
  según el tamaño de pantalla (`uiScale.ts`), y hay un botón para pasar
  a pantalla completa real (Fullscreen API) — pensado sobre todo para
  celular.

### Pendiente / roadmap
- Puntos de venta / comercio con precios dinámicos por estación.
- HUD y UI pulida (actualmente texto plano).
- Guardado periódico de `PlayerState` durante la partida (throttle).
- Multijugador (evaluando Colyseus para salas + estado sincronizado).
- Assets propios para la nave/proyectiles (hoy son gráficos vectoriales).
- Balanceo de física, daño y velocidad orbital.

## Arquitectura

```
src/
  game/
    config.ts          # Configuración de Phaser (escenas, physics, input)
    assetConstants.ts   # Tamaños/fracciones de spritesheets compartidos
    planetCatalog.ts    # Catálogo de sprites de planetas (16), con clase de tamaño
    procgen/
      random.ts           # PRNG determinista + hash de coordenadas (Squirrel3)
      universeGenerator.ts # Genera cada sector: estrella, planetas, asteroides
    scenes/
      BootScene.ts      # Precarga de spritesheets (sol, asteroides, planetas)
      MainScene.ts       # Escena principal: cámara, loop de juego
    entities/
      PlayerShip.ts       # Nave del jugador (input ya resuelto + LightBody)
      Asteroid.ts          # Asteroide destructible a tiros (LightBody)
      Projectile.ts         # Proyectil disparado por la nave
      ResourcePickup.ts      # Mineral flotante recolectable (LightBody)
      CelestialBody.ts        # Estrella/planeta (MassiveBody, con órbita propia)
    physics/
      GravitySystem.ts       # Cálculo de gravedad tipo "sphere of influence"
    systems/
      Inventory.ts             # Recursos + soporte vital del jugador
      InputController.ts        # Input unificado PC (mouse+teclado) / móvil (joysticks)
      CombatSystem.ts            # Proyectiles, impactos y minerales flotantes
      CollisionSystem.ts          # Colisiones asteroide/nave vs astros
      UniverseStreamer.ts          # Carga/descarga de sectores según la nave
      Minimap.ts                    # Minimapa circular
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

## Controles

**PC**
- `WASD` / flechas: trasladarse (arriba/abajo/izquierda/derecha, en espacio absoluto — no relativo a hacia dónde mira la nave)
- Mouse: apuntar (la nave siempre gira hacia el cursor)
- Click izquierdo (sostenido): disparar
- Rueda del mouse: zoom in/out

**Móvil (táctil)**
- Joystick izquierdo: trasladarse
- Joystick derecho: apuntar — al superar la zona muerta, dispara automáticamente
- Pellizcar con dos dedos (fuera de los joysticks): zoom in/out

En ambos casos, la nave queda siempre centrada en pantalla y la cámara la sigue sin retraso.

## Stack

- [Phaser 3](https://phaser.io/) — motor de juego
- [Vite](https://vitejs.dev/) — build tool
- TypeScript
- [Firebase](https://firebase.google.com/) — Auth + Firestore (login,
  registro y estado persistente del jugador)
