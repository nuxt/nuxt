import test from 'ava'
import { Nuxt, Generator } from '..'

test('initRoutes with routes (fn => array)', async t => {
  const array = ['/1', '/2', '/3', '/4']
  const config = {
    generate: {
      routes: array
    }
  }
  const nuxt = new Nuxt(config)
  const generator = new Generator(nuxt)
  const routes = await generator.initRoutes()

  t.is(routes.length, array.length)
  routes.map((route, index) => {
    t.is(route.route, array[index])
  })
})

test('initRoutes with routes (fn())', async t => {
  const array = ['/1', '/2', '/3', '/4']
  const config = {
    generate: {
      routes() {
        return array
      }
    }
  }
  const nuxt = new Nuxt(config)
  const generator = new Generator(nuxt)
  const routes = await generator.initRoutes()

  t.is(routes.length, array.length)
  routes.map((route, index) => {
    t.is(route.route, array[index])
  })
})

test('initRoutes with routes (fn(args))', async t => {
  const config = {
    generate: {
      routes(array) {
        return array
      }
    }
  }
  const nuxt = new Nuxt(config)
  const generator = new Generator(nuxt)
  const array = ['/1', '/2', '/3', '/4']
  const routes = await generator.initRoutes(array)

  t.is(routes.length, array.length)
  routes.map((route, index) => {
    t.is(route.route, array[index])
  })
})

test('initRoutes with routes (fn(cb, args))', async t => {
  const config = {
    generate: {
      routes(cb, arg1, arg2, arg3, arg4) {
        cb(null, [ arg1, arg2, arg3, arg4 ])
      }
    }
  }
  const nuxt = new Nuxt(config)
  const generator = new Generator(nuxt)
  const array = ['/1', '/2', '/3', '/4']
  const routes = await generator.initRoutes(...array)

  t.is(routes.length, array.length)
  routes.map((route, index) => {
    t.is(route.route, array[index])
  })
})
