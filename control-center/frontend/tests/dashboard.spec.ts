import { expect, test } from '@playwright/test'

test('local dashboard reads real API and makes no external requests', async ({ page }) => {
  const external: string[] = []
  const errors: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.badge')).toHaveText('● ONLINE')
  const response = await page.request.get('/api/system')
  expect(response.status()).toBe(200)
  const info = await response.json()
  expect(info.hostname).toBeTruthy()
  await expect(page.locator('main')).toContainText('Хост: ' + info.hostname)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('API failure clears metrics and reconnects', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.badge')).toHaveText('● ONLINE')
  await page.route('**/api/system', route => route.abort())
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.badge')).toHaveText('● OFFLINE')
  await expect(page.locator('main')).toContainText('Хост: —')
  await page.unroute('**/api/system')
  await expect(page.locator('.badge')).toHaveText('● ONLINE', { timeout: 10000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('missing metrics display unavailable', async ({ page }) => {
  await page.route('**/api/system', route => route.fulfill({
    json: { hostname: 'fixture', memoryTotalBytes: null, memoryAvailableBytes: null, load1: null, diskTotalBytes: null, diskFreeBytes: null, timestamp: '2026-10-24T00:00:00Z' }
  }))
  await page.goto('/')
  await expect(page.locator('.badge')).toHaveText('● ONLINE')
  await expect(page.getByText('Недоступно', { exact: true })).toHaveCount(4)
})

test('stalled API clears stale ONLINE metrics', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.badge')).toHaveText('● ONLINE')
  await page.route('**/api/system', async route => {
    await new Promise(resolve => setTimeout(resolve, 6000))
    await route.abort().catch(() => {})
  })
  await expect(page.locator('.badge')).toHaveText('● OFFLINE', { timeout: 8000 })
  await expect(page.getByRole('alert')).toContainText('Превышено время ожидания API')
  await expect(page.locator('main')).toContainText('Хост: —')
})
