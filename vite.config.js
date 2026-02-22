import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3007,
    host: '0.0.0.0'
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/game.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
})
