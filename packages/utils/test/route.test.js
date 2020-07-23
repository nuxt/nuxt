import { flatRoutes, createRoutes, guardDir, promisifyRoute } from '../src/route'

describe('util: route', () => {
  test('should flat route with path', () => {
    const routes = flatRoutes([
      { name: 'login', path: '/login' },
      { name: 'about', path: '/about' },
      {
        name: 'posts',
        path: '',
        children: [
          { name: 'posts-list', path: '' },
          { name: 'posts-create', path: 'post' }
        ]
      }
    ])
    expect(routes).toEqual(['/login', '/about', '/', '/post'])
  })

  test('should ignore route with * and :', () => {
    const routes = flatRoutes([
      { name: 'login', path: '/login' },
      { name: 'foo', path: '/foo/:id' },
      { name: 'bar', path: '/bar/*' }
    ])
    expect(routes).toEqual(['/login'])
  })

  test('should resolve route with /', () => {
    const routes = flatRoutes([
      {
        name: 'foo',
        path: '/',
        children: [
          { name: 'foo-bar', path: 'foo/bar' },
          { name: 'foo-baz', path: 'foo/baz' }
        ]
      }
    ])
    expect(routes).toEqual(['/', '/foo/bar', '/foo/baz'])
  })

  test('should flat absolute routes', () => {
    const routes = flatRoutes([
      {
        name: 'foo',
        path: '/foo',
        children: [
          { name: 'foo-bar', path: '/foo/bar' },
          { name: 'foo-baz', path: '/foo/baz' }
        ]
      }
    ])

    expect(routes).toEqual(['/foo', '/foo/bar', '/foo/baz'])
  })

  test('should flat absolute routes with empty path', () => {
    const routes = flatRoutes([
      {
        name: 'foo',
        path: '/foo',
        children: [
          { name: 'foo-root', path: '' },
          { name: 'foo-bar', path: '/foo/bar' },
          { name: 'foo-baz', path: '/foo/baz' }
        ]
      }
    ])

    expect(routes).toEqual(['/foo', '/foo/bar', '/foo/baz'])
  })

  describe('util: route guard', () => {
    test('should guard parent dir', () => {
      expect(() => {
        guardDir({ dir1: '/root/parent', dir2: '/root' }, 'dir1', 'dir2')
      }).toThrow()
    })

    test('should guard same dir', () => {
      expect(() => {
        guardDir({ dir1: '/root/parent', dir2: '/root/parent' }, 'dir1', 'dir2')
      }).toThrow()
    })

    test('should not guard same level dir', () => {
      expect(() => {
        guardDir({ dir1: '/root/parent-next', dir2: '/root/parent' }, 'dir1', 'dir2')
      }).not.toThrow()
    })

    test('should not guard same level dir - 2', () => {
      expect(() => {
        guardDir({ dir1: '/root/parent', dir2: '/root/parent-next' }, 'dir1', 'dir2')
      }).not.toThrow()
    })

    test('should not guard child dir', () => {
      expect(() => {
        guardDir({ dir1: '/root/parent', dir2: '/root/parent/child' }, 'dir1', 'dir2')
      }).not.toThrow()
    })
  })

  describe('util: route promisifyRoute', () => {
    test('should promisify array routes', () => {
      const array = [1]
      const promise = promisifyRoute(array)
      expect(typeof promise).toBe('object')
      return promise.then((res) => {
        expect(res).toBe(array)
      })
    })

    test('should promisify functional routes', () => {
      const array = [1, 2]
      const fn = function () {
        return array
      }
      const promise = promisifyRoute(fn)
      expect(typeof promise).toBe('object')
      return promise.then((res) => {
        expect(res).toBe(array)
      })
    })

    test('should promisify promisable functional routes', () => {
      const array = [1, 2, 3]
      const fn = function () {
        return new Promise((resolve) => {
          resolve(array)
        })
      }
      const promise = promisifyRoute(fn)
      expect(typeof promise).toBe('object')
      return promise.then((res) => {
        expect(res).toBe(array)
      })
    })

    test('should promisify promisable functional routes with arguments', () => {
      const fn = function (array) {
        return new Promise((resolve) => {
          resolve(array)
        })
      }
      const array = [1, 2, 3]
      const promise = promisifyRoute(fn, array)
      expect(typeof promise).toBe('object')
      return promise.then((res) => {
        expect(res).toBe(array)
      })
    })

    test('should promisify functional routes with error', () => {
      const fn = function (cb) {
        cb(new Error('Error here'))
      }
      const promise = promisifyRoute(fn)
      expect(typeof promise).toBe('object')
      return promise.catch((e) => {
        expect(e.message).toBe('Error here')
      })
    })

    test('should promisify functional routes with arguments and error', () => {
      const fn = function (cb, array) {
        cb(new Error('Error here: ' + array.join()))
      }
      const array = [1, 2, 3, 4]
      const promise = promisifyRoute(fn, array)
      expect(typeof promise).toBe('object')
      return promise.catch((e) => {
        expect(e.message).toBe('Error here: ' + array.join())
      })
    })

    test('should promisify functional routes with result', () => {
      const array = [1, 2, 3, 4]
      const fn = function (cb) {
        cb(null, array)
      }
      const promise = promisifyRoute(fn)
      expect(typeof promise).toBe('object')
      return promise.then((res) => {
        expect(res).toBe(array)
      })
    })

    test('should promisify functional routes with arguments and result', () => {
      const fn = function (cb, array, object) {
        cb(null, { array, object })
      }
      const array = [1, 2, 3, 4]
      const object = { a: 1 }
      const promise = promisifyRoute(fn, array, object)
      expect(typeof promise).toBe('object')
      return promise.then((res) => {
        expect(res.array).toBe(array)
        expect(res.object).toBe(object)
      })
    })
  })

  describe('util: route create', () => {
    const files = [
      'pages/index.vue',
      'pages/_param.vue',
      'pages/subpage/_param.vue',
      'pages/snake_case_route.vue',
      'pages/another_route/_id.vue',
      'pages/another_route/_id.vue',
      'pages/parent/index.vue',
      'pages/parent/child/index.vue',
      'pages/parent/child/test.vue'
    ]
    const srcDir = '/some/nuxt/app'
    const pagesDir = 'pages'

    test.posix('createRoutes should allow snake case routes in posix system', () => {
      const routesResult = createRoutes({ files, srcDir, pagesDir })
      expect(routesResult).toMatchSnapshot()
    })

    test.win('createRoutes should allow snake case routes in windows system', () => {
      const routesResult = createRoutes({ files, srcDir, pagesDir })
      expect(routesResult).toMatchSnapshot()
    })

    test.posix('createRoutes should enforce trailing slashes when configured to', () => {
      const routesResult = createRoutes({ files, srcDir, pagesDir, trailingSlash: true })
      expect(routesResult).toMatchSnapshot()
    })

    test.posix('createRoutes should remove trailing slashes when configured to', () => {
      const routesResult = createRoutes({ files, srcDir, pagesDir, trailingSlash: false })
      expect(routesResult).toMatchSnapshot()
    })
  })
})
