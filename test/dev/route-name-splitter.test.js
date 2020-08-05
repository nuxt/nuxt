import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

describe('route-name-splitter', () => {
  test('Check routes names', () => {
    return readFile(
      resolve(__dirname, '..', 'fixtures/route-name-splitter/.nuxt/router.js'),
      'utf-8'
    ).then((routerFile) => {
      routerFile = routerFile
        .slice(routerFile.indexOf('routes: ['))
        .replace('routes: [', '[')
        .replace(/ _[0-9A-Za-z]+,/g, ' "",')
      routerFile = routerFile.substr(
        routerFile.indexOf('['),
        routerFile.lastIndexOf(']') + 1
      )
      const routes = eval('( ' + routerFile + ')') // eslint-disable-line no-eval

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
})
