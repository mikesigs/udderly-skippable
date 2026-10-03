import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const single = !!process.env.SINGLEFILE;

export default defineConfig({
  base: './',
  plugins: single ? [viteSingleFile()] : [],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: single ? 1e9 : 8192,
    chunkSizeWarningLimit: 1500,
  },
});
