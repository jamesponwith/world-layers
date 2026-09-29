# Strata — Earth, layer by layer

**Live:** https://jamesponwith.github.io/world-layers/

An interactive 3D cutaway of planet Earth, from the exosphere down to the inner core, built with Three.js and Vite.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## What's in it

- **Cutaway planet.** A wedge is cut out of a textured Earth (day/night, city lights, clouds, specular oceans) to expose 8 interior layers and 5 atmospheric layers. Drag the *Cutaway* slider from 0° to 270°.
- **Living cross-section.** Mantle convection with rising plumes and sinking slabs, a swirling molten outer core, and a crystalline inner core, all shaded procedurally.
- **Data views** (keys `1`–`5`). Recolour the cross-section by temperature, density, pressure or P-wave velocity, using a simplified PREM model with isolines.
- **Probe.** Hover anywhere on the cut face to read depth, temperature, pressure, density and seismic velocities. The profile chart and an iso-depth ring follow your cursor.
- **Peel.** Dissolve layers away one at a time (`[` / `]`) to see each layer's surface.
- **Earthquake** (`Q`). P- and S-wave rays are traced through the velocity model with a conserved ray parameter (Snell's law). The shadow zones come out of the physics rather than being drawn in by hand.
- **Magnetosphere and aurora.** Tilted dipole field lines, squashed on the dayside, plus auroral ovals.
- **Schematic ↔ true scale** (`S`). Thin layers are exaggerated by default; toggle to see real proportions.
- **Guided tour** (`T`). Ten narrated camera stops from space to the centre.

Press `?` in the app for all shortcuts.

## Layout

```
src/
  data/earth.js        layer definitions + physical profiles (PREM-style interior, US Std. Atmosphere)
  data/scale.js        true ↔ schematic radius mapping
  data/tour.js         guided tour script
  scene/               planet surface, interior cross-section, magnetosphere, seismic rays, stars
  shaders/common.js    shared GLSL: noise, colour ramps, cutaway wedge, radius mapping
  ui/                  panels, dock, chart, callout labels
```

Earth textures come from the three.js examples (NASA Blue Marble / Black Marble derived).
