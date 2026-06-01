# Gravity Snake X

A 3D orbital snake simulation around a rotating Earth, developed with HTML, CSS, JavaScript, Three.js, and GSAP.

## Core Mechanics

* **Spherical Surface Navigation**: The cybernetic entity moves along the 3D surface grid of Earth.
* **Dynamic Camera System**: The PerspectiveCamera matches the target position above the local surface normal and aligns its vertical vector with the normal to stabilize the horizon.
* **Hyper Charge Booster**: Activate boosters with keyboard input or the mobile HUD interface. Boosters consume the Hyper Charge meter, which recharges over time.
* **Procedural Sound Engine**: The Web Audio API generates synthetic audio nodes for energy collection, speed boosting, sector transitions, menu clicks, and connection failures.

## Power-Ups and Hazards

### Cybernetic Upgrades
* **Shield (🛡️)**: Protects the system from a single collision with defense arrays or the tail.
* **Magnet (🧲)**: Creates a gravitational pull drawing nearby energy orbs and coins.
* **2x Double Score (🪙)**: Multiplies score points and coins gathered during the active timeframe.

### Orbital Hazards
* **Cyber Shield Domes**: Static defense cubes occupying the surface path.
* **Space Storm Satellites**: Rotating planetary satellite systems sweeping across the spherical grid.
* **Volcanic Core Flares**: Pulsating magma structures that expand and contract.

## Sectors

* **Sector 01: Neo-Earth**: Low risk environment. Clean orbital path with 1.0x speed, targeting 10 energy orbs.
* **Sector 02: Cyber Shield**: Moderate risk environment. Grid shields activated with static cubes, targeting 15 energy orbs at 1.25x speed.
* **Sector 03: Space Storm**: High risk environment. Rotating satellite arrays, targeting 20 energy orbs at 1.5x speed.
* **Sector 04: Volcanic Core**: Critical risk environment. Shifting magma zones, targeting 25 energy orbs at 1.8x speed.
* **Sectors 05-07 (Abyssal Zone, Quantum Fracture, Singularity)**: Locked planetary regions reserved for system diagnostics.

## Player Customization and Logs

### Cybernetic Garage
Purchase custom skins using collected coins:
* **Classic Neon**: Standard cyan skin, unlocked by default.
* **Gold Plated**: Metallic finish, 50 coins.
* **Magma Core**: Emissive finish, 100 coins.
* **Ghost Mode**: Transparent finish, 200 coins.

### Data Logs and Objectives
Track achievements to secure bonus currency:
* **Initiation**: Complete 5 games to earn 20 coins.
* **Energy Hoarder**: Collect 100 orbs to earn 50 coins.
* **Power Overwhelming**: Use 10 power-ups to earn 30 coins.
* **Gold Rush**: Collect 500 coins to earn 100 coins.
* **Daily Objectives**: Collect 30 orbs, collect 10 coins, or complete 3 games daily to secure extra currency.

## Control Interface

* **Left Navigation**: `Left Arrow` / `A` / On-screen Steer Left Button
* **Right Navigation**: `Right Arrow` / `D` / On-screen Steer Right Button
* **Hyper Boost**: `Space` / `Shift` / On-screen Boost Button
* **Audio Settings**: Toggle music, sound effects, and master volume using the persistent audio interface.

## Installation and Launch

1. Clone this repository to your local directory.
2. Serve the directory using a local web server:
   ```bash
   npx serve
   ```
   or
   ```bash
   python -m http.server 8000
   ```
3. Open the host address in a WebGL-compatible web browser.
