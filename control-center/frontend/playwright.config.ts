import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  timeout: 20000,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: [
    { command: 'go run .', cwd: '../backend', url: 'http://127.0.0.1:4174/api/health', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 30000 }
  ]
})
