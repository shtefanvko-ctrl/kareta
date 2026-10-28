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

test('fleet renders offline workers, resources, task scope and mobile layout', async ({ page }) => {
  await page.route('**/api/fleet', route => route.fulfill({json:{total:2,online:1,ready:0,dispatchEnabled:true,tasks:[],nodes:[
    {id:'coordinator',role:'coordinator',name:'Координатор CARAT',status:'online',ready:false,metrics:{cpuCores:4,load1:0.2,memoryTotalBytes:8589934592,memoryAvailableBytes:4294967296,diskFreeBytes:21474836480},availableCpu:0,availableMemoryBytes:0,activeTasks:0,reserveCpu:0,reserveMemoryBytes:0,lastSeen:'2026-10-28T12:00:00Z'},
    {id:'worker-2',role:'',name:'Вторая машина',status:'offline',ready:false,metrics:null,availableCpu:0,availableMemoryBytes:0,activeTasks:0,reserveCpu:1,reserveMemoryBytes:1073741824,lastSeen:null}
  ]}}))
  await page.goto('/')
  const fleet=page.locator('.fleet')
  await expect(fleet).toContainText('Всего машин: 2')
  await expect(fleet).toContainText('Вторая машина')
  await expect(fleet).toContainText('Ресурсы исключены из распределения')
  await expect(fleet.locator('select option')).toHaveCount(2)
  let body:unknown
  await page.route('**/api/tasks',async route=>{body=route.request().postDataJSON();expect(route.request().headers()['authorization']).toBe('Bearer test-only-operator-key');await route.fulfill({status:202,json:{status:'queued'}})})
  await page.getByLabel('Ключ оператора').fill('test-only-operator-key')
  await page.getByRole('button',{name:'Запустить диагностику'}).click()
  await expect(page.getByRole('status')).toContainText('поставлена в очередь')
  expect(body).toEqual({kind:'system-probe',nodeId:''})
  await expect(page.getByLabel('Ключ оператора')).toHaveValue('')
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)}
  await page.route('**/api/fleet',route=>route.abort())
  await expect(fleet.getByRole('alert')).toContainText('Реестр машин недоступен')
  await expect(fleet.locator('.machine')).toHaveCount(0)
})
