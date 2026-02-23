import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 3007,
    host: '0.0.0.0'
  },
  base: '/ghostshift/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/game.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        manualChunks: {
          // Separate Phaser into its own chunk for better caching
          'phaser': ['phaser']
        }
      }
    }
  }
})
