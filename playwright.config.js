import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3010/ghostshift/',
    headless: true,
    viewport: { width: 900, height: 700 }
  }
})
