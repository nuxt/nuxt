import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

describe('route sort slash', () => {
  test('Check routes paths', async () => {
    const routesFile = await readFile(resolve(__dirname, '..', 'fixtures/route-sort-slash/.nuxt/routes.json'), 'utf-8')
    const routes = JSON.parse(routesFile)
    expect(routes[0].path).toBe('/about')
    expect(routes[1].path).toBe('/de')
    expect(routes[2].path).toBe('/poetry')
    expect(routes[3].path).toBe('/reports')
    expect(routes[4].path).toBe('/tech')
    expect(routes[5].path).toBe('/de/about')
    expect(routes[6].path).toBe('/de/poetry')
    expect(routes[7].path).toBe('/de/reports')
    expect(routes[8].path).toBe('/de/tech')
    expect(routes[9].path).toBe('/')
    expect(routes[10].path).toBe('/de/:post')
    expect(routes[11].path).toBe('/de/test*')
    expect(routes[12].path).toBe('/de/*')
    expect(routes[13].path).toBe('/:post')
    expect(routes[14].path).toBe('/test*')
    expect(routes[15].path).toBe('/*')
  })
})
