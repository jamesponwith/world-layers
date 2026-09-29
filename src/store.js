import { INTERIOR_COUNT } from './data/earth.js';

// Minimal observable app state. UI and scene subscribe to changes.
export function createStore(initial) {
  const state = structuredClone(initial);
  const listeners = new Set();
  return {
    state,
    set(patch) {
      const changed = {};
      for (const [key, value] of Object.entries(patch)) {
        const next = key === 'toggles' ? { ...state.toggles, ...value } : value;
        if (JSON.stringify(state[key]) !== JSON.stringify(next)) {
          state[key] = next;
          changed[key] = true;
        }
      }
      if (Object.keys(changed).length) listeners.forEach((fn) => fn(state, changed));
    },
    toggle(name) {
      this.set({ toggles: { [name]: !state.toggles[name] } });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore({
  mode: 'material',
  cut: 90, // degrees
  peel: INTERIOR_COUNT - 1, // outermost visible interior layer
  schematic: true,
  selected: -1,
  hover: -1,
  touring: false,
  toggles: {
    atmosphere: true,
    clouds: true,
    aurora: true,
    magnetosphere: false,
    labels: window.innerWidth >= 760,
    rotate: true,
  },
});
