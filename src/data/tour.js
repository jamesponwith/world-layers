// Guided tour: each step sets the scene and frames the camera. `view` targets
// a point on cut face A: radius in display units and polar angle from the
// north pole, then the camera distance and elevation. 'quake' frames the
// earthquake rays.

export const TOUR = [
  {
    title: 'A planet in layers',
    text: 'Earth is sorted by density: heavy iron sank to the centre while lighter rock and gas rose. We have cut a wedge out so you can see inside.',
    state: { mode: 'material', cut: 90, peel: 7, schematic: true, selected: -1, toggles: { atmosphere: true, magnetosphere: false, aurora: true } },
    view: { r: 0, polar: 90, distance: 5.2, elevation: 26, azimuth: 14 },
  },
  {
    title: 'The magnetic shield',
    text: 'The magnetosphere, generated deep in the core, deflects the solar wind. It is squashed on the day side and stretched into a long tail at night.',
    state: { selected: -1, toggles: { magnetosphere: true } },
    view: { r: 0, polar: 90, distance: 17, elevation: 24, azimuth: -60 },
  },
  {
    title: 'The atmosphere',
    text: 'Five layers of gas, from the weather-filled troposphere to the exosphere fading into space. In schematic view they are stretched so you can see them.',
    state: { selected: -1, toggles: { magnetosphere: false } },
    view: { r: 1.0, polar: 32, distance: 2.8, elevation: 28, azimuth: 10 },
  },
  {
    title: 'The crust',
    text: 'Everything humans have ever touched lives in this thin skin. Scaled to an apple, the crust would be thinner than its peel.',
    state: { selected: 7 },
    view: { r: 0.97, polar: 55, distance: 1.1, elevation: 14 },
  },
  {
    title: 'The mantle',
    text: 'Solid rock that flows like extremely slow toffee. Watch hot plumes rise from the core and cold ocean plates sink back down — this is what moves continents.',
    state: { selected: 3 },
    view: { r: 0.62, polar: 80, distance: 3.2, elevation: 12 },
  },
  {
    title: 'The core–mantle boundary',
    text: 'At 2,891 km, rock meets liquid metal. The temperature leaps by over 1,000 K and density almost doubles — a bigger contrast than between rock and air.',
    state: { selected: 2 },
    view: { r: 0.52, polar: 70, distance: 1.7, elevation: 12 },
  },
  {
    title: 'The outer core',
    text: 'Liquid iron swirls at kilometres per year. Twisted by Earth’s spin, these currents act as a dynamo and create the magnetic field.',
    state: { selected: 1, peel: 1 },
    view: { r: 0, polar: 90, distance: 2.6, elevation: 22 },
  },
  {
    title: 'The inner core',
    text: 'A solid iron ball about the size of the Moon, as hot as the Sun’s surface. It rotates slightly out of step with the rest of the planet.',
    state: { selected: 0, peel: 0 },
    view: { r: 0, polar: 90, distance: 1.3, elevation: 22 },
  },
  {
    title: 'How do we know?',
    text: 'Nobody has drilled past the crust. Instead, earthquakes light up the interior. S-waves cannot cross the liquid core, and P-waves bend around it, leaving shadow zones.',
    state: { selected: -1, peel: 7, mode: 'vp', cut: 110, quake: true },
    view: 'quake',
  },
  {
    title: 'A heat engine',
    text: 'The core is still hot from Earth’s formation 4.5 billion years ago and from radioactive decay. That heat drives everything — from volcanoes to the magnetic field.',
    state: { selected: -1, mode: 'temperature', cut: 90 },
    view: { r: 0, polar: 90, distance: 3.6, elevation: 26 },
  },
];
