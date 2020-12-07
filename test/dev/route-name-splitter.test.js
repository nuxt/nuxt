import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

describe('route-name-splitter', () => {
  test('Check routes names', async () => {
    const routesFile = await readFile(resolve(__dirname, '..', 'fixtures/route-name-splitter/.nuxt/routes.json'), 'utf-8')
    const routes = JSON.parse(routesFile)
    expect(routes[0].name).toBe('parent')
    expect(routes[1].name).toBe('posts')
    expect(routes[1].children[0].name).toBe('posts/id')
    expect(routes[2].name).toBe('parent/child')
    expect(routes[3].name).toBe('index')
    expect(routes[4].name).toBe('all/p/all')
    expect(routes[5].name).toBe('all/all')
    expect(routes[6].name).toBe('all')
  })
})
