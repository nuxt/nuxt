import path from 'path'
import { Utils, waitUntil } from '../utils'

describe('utils', () => {
  test('encodeHtml', () => {
    const html = '<h1>Hello</h1>'
    expect(Utils.encodeHtml(html)).toBe('&lt;h1&gt;Hello&lt;/h1&gt;')
  })

  test('getContext', () => {
    const ctx = Utils.getContext({ a: 1 }, { b: 2 })
    expect(Utils.getContext.length).toBe(2)
    expect(typeof ctx.req).toBe('object')
    expect(typeof ctx.res).toBe('object')
    expect(ctx.req.a).toBe(1)
    expect(ctx.res.b).toBe(2)
  })

  test('waitFor', async () => {
    const delay = 100
    const s = process.hrtime()
    await Utils.waitFor(delay)
    const t = process.hrtime(s)
    // Node.js makes no guarantees about the exact timing of when callbacks will fire
    // HTML5 specifies a minimum delay of 4ms for timeouts
    // although arbitrary, use this value to determine our lower limit
    expect((t[0] * 1e9 + t[1]) / 1e6).not.toBeLessThan(delay - 4)
    await Utils.waitFor()
  })

  test('waitUntil', async () => {
    expect(await waitUntil(() => true, 0.1, 100)).toBe(false)
    expect(await waitUntil(() => false, 0.1, 100)).toBe(true)
  })

  test('timeout (promise)', async () => {
    const result = await Utils.timeout(Promise.resolve('time not run out'), 100)
    expect(result).toBe('time not run out')
  })

  test('timeout (async function)', async () => {
    const result = await Utils.timeout(async () => {
      await Utils.waitFor(10)
      return 'time not run out'
    }, 100)
    expect(result).toBe('time not run out')
  })

  test('timeout (timeout in 100ms)', async () => {
    const timeout = Utils.timeout(Utils.waitFor(200), 100, 'timeout test 100ms')
    await expect(timeout).rejects.toThrow('timeout test 100ms')
  })

  test('timeout (async timeout in 100ms)', async () => {
    const timeout = Utils.timeout(async () => {
      await Utils.waitFor(500)
    }, 100, 'timeout test 100ms')
    await expect(timeout).rejects.toThrow('timeout test 100ms')
  })

  test('urlJoin', () => {
    expect(Utils.urlJoin('test', '/about')).toBe('test/about')
  })

  test('promisifyRoute (array)', () => {
    const array = [1]
    const promise = Utils.promisifyRoute(array)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res).toBe(array)
    })
  })

  test('promisifyRoute (fn => array)', () => {
    const array = [1, 2]
    const fn = function () {
      return array
    }
    const promise = Utils.promisifyRoute(fn)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res).toBe(array)
    })
  })

  test('promisifyRoute (fn => promise)', () => {
    const array = [1, 2, 3]
    const fn = function () {
      return new Promise((resolve) => {
        resolve(array)
      })
    }
    const promise = Utils.promisifyRoute(fn)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res).toBe(array)
    })
  })

  test('promisifyRoute ((fn(args) => promise))', () => {
    const fn = function (array) {
      return new Promise((resolve) => {
        resolve(array)
      })
    }
    const array = [1, 2, 3]
    const promise = Utils.promisifyRoute(fn, array)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res).toBe(array)
    })
  })

  test('promisifyRoute (fn(cb) with error)', () => {
    const fn = function (cb) {
      cb(new Error('Error here'))
    }
    const promise = Utils.promisifyRoute(fn)
    expect(typeof promise).toBe('object')
    return promise.catch((e) => {
      expect(e.message).toBe('Error here')
    })
  })

  test('promisifyRoute (fn(cb, args) with error)', () => {
    const fn = function (cb, array) {
      cb(new Error('Error here: ' + array.join()))
    }
    const array = [1, 2, 3, 4]
    const promise = Utils.promisifyRoute(fn, array)
    expect(typeof promise).toBe('object')
    return promise.catch((e) => {
      expect(e.message).toBe('Error here: ' + array.join())
    })
  })

  test('promisifyRoute (fn(cb) with result)', () => {
    const array = [1, 2, 3, 4]
    const fn = function (cb) {
      cb(null, array)
    }
    const promise = Utils.promisifyRoute(fn)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res).toBe(array)
    })
  })

  test('promisifyRoute (fn(cb, args) with result)', () => {
    const fn = function (cb, array, object) {
      cb(null, { array, object })
    }
    const array = [1, 2, 3, 4]
    const object = { a: 1 }
    const promise = Utils.promisifyRoute(fn, array, object)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res.array).toBe(array)
      expect(res.object).toBe(object)
    })
  })

  test('chainFn (mutate, mutate)', () => {
    // Pass more than one argument to test that they're actually taken into account
    const firstFn = function (obj, count) {
      obj.foo = count + 1
    }
    const secondFn = function (obj, count) {
      obj.bar = count + 2
    }

    const chainedFn = Utils.chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (mutate, return)', () => {
    const firstFn = function (obj, count) {
      obj.foo = count + 1
    }
    const secondFn = function (obj, count) {
      return Object.assign({}, obj, { bar: count + 2 })
    }

    const chainedFn = Utils.chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (return, mutate)', () => {
    const firstFn = function (obj, count) {
      return Object.assign({}, obj, { foo: count + 1 })
    }
    const secondFn = function (obj, count) {
      obj.bar = count + 2
    }

    const chainedFn = Utils.chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (return, return)', () => {
    const firstFn = function (obj, count) {
      return Object.assign({}, obj, { foo: count + 1 })
    }
    const secondFn = function (obj, count) {
      return Object.assign({}, obj, { bar: count + 2 })
    }

    const chainedFn = Utils.chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('flatRoutes', () => {
    const routes = Utils.flatRoutes([
      { name: 'login', path: '/login' },
      { name: 'about', path: '/about' },
      { name: 'posts',
        path: '',
        children: [
          { name: 'posts-list',
            path: ''
          },
          { name: 'posts-create',
            path: 'post'
          }
        ]
      }
    ])
    expect(routes).toMatchObject([ '/login', '/about', '', '/post' ])
  })

  describe('relativeTo', () => {
    const path1 = path.join(path.sep, 'foo', 'bar')
    const path2 = path.join(path.sep, 'foo', 'baz')

    test('makes path relative to dir', () => {
      expect(Utils.relativeTo(path1, path2)).toBe(Utils.wp(`..${path.sep}baz`))
    })

    test('keeps webpack inline loaders prepended', () => {
      expect(Utils.relativeTo(path1, `loader1!loader2!${path2}`))
        .toBe(Utils.wp(`loader1!loader2!..${path.sep}baz`))
    })
  })

  describe('guardDir', () => {
    test('Parent dir is guarded', () => {
      expect(() => {
        Utils.guardDir({
          dir1: '/root/parent',
          dir2: '/root'
        }, 'dir1', 'dir2')
      }).toThrow()
    })

    test('Same dir is guarded', () => {
      expect(() => {
        Utils.guardDir({
          dir1: '/root/parent',
          dir2: '/root/parent'
        }, 'dir1', 'dir2')
      }).toThrow()
    })

    test('Same level dir is not guarded', () => {
      expect(() => {
        Utils.guardDir({
          dir1: '/root/parent-next',
          dir2: '/root/parent'
        }, 'dir1', 'dir2')
      }).not.toThrow()
    })

    test('Same level dir is not guarded 2', () => {
      expect(() => {
        Utils.guardDir({
          dir1: '/root/parent',
          dir2: '/root/parent-next'
        }, 'dir1', 'dir2')
      }).not.toThrow()
    })

    test('Child dir is not guarded', () => {
      expect(() => {
        Utils.guardDir({
          dir1: '/root/parent',
          dir2: '/root/parent/child'
        }, 'dir1', 'dir2')
      }).not.toThrow()
    })
  })
})

test('createRoutes should allow snake case routes', () => {
  const files = [
    'pages/_param.vue',
    'pages/subpage/_param.vue',
    'pages/snake_case_route.vue',
    'pages/another_route/_id.vue'
  ]
  const srcDir = '/some/nuxt/app'
  const pagesDir = 'pages'
  const routesResult = Utils.createRoutes(files, srcDir, pagesDir)
  const expectedResult = [
    {
      name: 'snake_case_route',
      path: '/snake_case_route',
      component: Utils.r('/some/nuxt/app/pages/snake_case_route.vue'),
      chunkName: 'pages/snake_case_route'
    },
    {
      name: 'another_route-id',
      path: '/another_route/:id?',
      component: Utils.r('/some/nuxt/app/pages/another_route/_id.vue'),
      chunkName: 'pages/another_route/_id'
    },
    {
      name: 'subpage-param',
      path: '/subpage/:param?',
      component: Utils.r('/some/nuxt/app/pages/subpage/_param.vue'),
      chunkName: 'pages/subpage/_param'
    },
    {
      name: 'param',
      path: '/:param?',
      component: Utils.r('/some/nuxt/app/pages/_param.vue'),
      chunkName: 'pages/_param'
    }
  ]

  expect(routesResult).toEqual(expectedResult)
})
