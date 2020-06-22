import { Nuxt, Generator } from '../utils'

describe('generator', () => {
  test('initRoutes with routes (fn => array)', async () => {
    const array = ['/1', '/2', '/3', '/4']
    const config = {
      generate: {
        routes: array
      }
    }
    const nuxt = new Nuxt(config)
    await nuxt.ready()
    const generator = new Generator(nuxt)
    generator.getAppRoutes = jest.fn(() => [])
    const routes = await generator.initRoutes()

    expect(routes.length).toBe(array.length)
    routes.forEach((route, index) => {
      expect(route.route).toBe(array[index])
    })
  })

  test('initRoutes with routes (fn())', async () => {
    const array = ['/1', '/2', '/3', '/4']
    const config = {
      generate: {
        routes () {
          return array
        }
      }
    }
    const nuxt = new Nuxt(config)
    await nuxt.ready()
    const generator = new Generator(nuxt)
    generator.getAppRoutes = jest.fn(() => [])

    const routes = await generator.initRoutes()

    expect(routes.length).toBe(array.length)
    routes.forEach((route, index) => {
      expect(route.route).toBe(array[index])
    })
  })

  test('initRoutes with routes (fn(args))', async () => {
    const config = {
      generate: {
        routes (array) {
          return array
        }
      }
    }
    const nuxt = new Nuxt(config)
    await nuxt.ready()
    const generator = new Generator(nuxt)
    generator.getAppRoutes = jest.fn(() => [])
    const array = ['/1', '/2', '/3', '/4']
    const routes = await generator.initRoutes(array)

    expect(routes.length).toBe(array.length)
    routes.forEach((route, index) => {
      expect(route.route).toBe(array[index])
    })
  })

  test('initRoutes with routes (fn(cb, args))', async () => {
    const config = {
      generate: {
        routes (cb, arg1, arg2, arg3, arg4) {
          cb(null, [arg1, arg2, arg3, arg4])
        }
      }
    }
    const nuxt = new Nuxt(config)
    await nuxt.ready()
    const generator = new Generator(nuxt)
    generator.getAppRoutes = jest.fn(() => [])
    const array = ['/1', '/2', '/3', '/4']
    const routes = await generator.initRoutes(...array)

    expect(routes.length).toBe(array.length)
    routes.forEach((route, index) => {
      expect(route.route).toBe(array[index])
    })
  })
})
