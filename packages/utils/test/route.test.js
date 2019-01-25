import path from 'path'

import { r } from '../src/resolve'
import {
  flatRoutes, cleanChildrenRoutes, createRoutes, guardDir, promisifyRoute
} from '../src/route'

describe('util: route', () => {
  test('flatRoutes', () => {
    const routes = flatRoutes([
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

  test('createRoutes should allow snake case routes', () => {
    const files = [
      'pages/_param.vue',
      'pages/subpage/_param.vue',
      'pages/snake_case_route.vue',
      'pages/another_route/_id.vue'
    ]
    const srcDir = '/some/nuxt/app'
    const pagesDir = 'pages'
    const routesResult = createRoutes(files, srcDir, pagesDir)
    const expectedResult = [
      {
        name: 'snake_case_route',
        path: '/snake_case_route',
        component: r('/some/nuxt/app/pages/snake_case_route.vue'),
        chunkName: 'pages/snake_case_route'
      },
      {
        name: 'another_route-id',
        path: '/another_route/:id?',
        component: r('/some/nuxt/app/pages/another_route/_id.vue'),
        chunkName: 'pages/another_route/_id'
      },
      {
        name: 'subpage-param',
        path: '/subpage/:param?',
        component: r('/some/nuxt/app/pages/subpage/_param.vue'),
        chunkName: 'pages/subpage/_param'
      },
      {
        name: 'param',
        path: '/:param?',
        component: r('/some/nuxt/app/pages/_param.vue'),
        chunkName: 'pages/_param'
      }
    ]

    expect(routesResult).toEqual(expectedResult)
  })

  test('Parent dir is guarded', () => {
    expect(() => {
      guardDir({
        dir1: '/root/parent',
        dir2: '/root'
      }, 'dir1', 'dir2')
    }).toThrow()
  })

  test('Same dir is guarded', () => {
    expect(() => {
      guardDir({
        dir1: '/root/parent',
        dir2: '/root/parent'
      }, 'dir1', 'dir2')
    }).toThrow()
  })

  test('Same level dir is not guarded', () => {
    expect(() => {
      guardDir({
        dir1: '/root/parent-next',
        dir2: '/root/parent'
      }, 'dir1', 'dir2')
    }).not.toThrow()
  })

  test('Same level dir is not guarded 2', () => {
    expect(() => {
      guardDir({
        dir1: '/root/parent',
        dir2: '/root/parent-next'
      }, 'dir1', 'dir2')
    }).not.toThrow()
  })

  test('Child dir is not guarded', () => {
    expect(() => {
      guardDir({
        dir1: '/root/parent',
        dir2: '/root/parent/child'
      }, 'dir1', 'dir2')
    }).not.toThrow()
  })

  test('promisifyRoute (array)', () => {
    const array = [1]
    const promise = promisifyRoute(array)
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
    const promise = promisifyRoute(fn)
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
    const promise = promisifyRoute(fn)
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
    const promise = promisifyRoute(fn, array)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res).toBe(array)
    })
  })

  test('promisifyRoute (fn(cb) with error)', () => {
    const fn = function (cb) {
      cb(new Error('Error here'))
    }
    const promise = promisifyRoute(fn)
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
    const promise = promisifyRoute(fn, array)
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
    const promise = promisifyRoute(fn)
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
    const promise = promisifyRoute(fn, array, object)
    expect(typeof promise).toBe('object')
    return promise.then((res) => {
      expect(res.array).toBe(array)
      expect(res.object).toBe(object)
    })
  })
})
