import { defineConfig } from 'vite';

export default defineConfig({
  // Sub-path deploys (e.g. GitHub Pages project sites) set BASE_PATH,
  // e.g. BASE_PATH=/world-layers/ npm run build.
  base: process.env.BASE_PATH || '/',
});
