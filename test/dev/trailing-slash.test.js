import { loadFixture, getPort, Nuxt } from '../utils'

function runTest (name, expectations) {
  describe(name, () => {
    let port
    let nuxt = null

    beforeAll(async () => {
      const options = await loadFixture(name)
      nuxt = new Nuxt(options)
      await nuxt.ready()
      port = await getPort()
      await nuxt.server.listen(port, 'localhost')
    })

    for (const route in expectations) {
      test(route, async () => {
        const { html } = await nuxt.server.renderRoute(route)
        for (const exp of expectations[route]) {
          expect(html).toContain(exp)
        }
      })
    }

    afterAll(async () => {
      await nuxt.close()
    })
  })
}

runTest('trailing-slash/with-true', {
  '/': [
    '[pages/index]'
  ],
  '/posts': [
    'statusCode:404'
  ],
  '/posts/': [
    '[pages/posts]',
    '[pages/posts/index]'
  ],
  '/posts/foo': [
    'statusCode:404'
  ],
  '/posts/foo/': [
    '[pages/posts]',
    '[pages/posts/_slug]'
  ]
})

runTest('trailing-slash/with-false', {
  '/': [
    '[pages/index]'
  ],
  '/posts': [
    '[pages/posts]'
    // '[pages/posts/index]' // <--seems wired
  ],
  '/posts/': [
    '[pages/posts]',
    '[pages/posts/index]'
  ],
  '/posts/foo': [
    '[pages/posts]',
    '[pages/posts/_slug]'
  ],
  '/posts/foo/': [
    'statusCode:404'
  ]
})

runTest('trailing-slash/with-default', {
  '/': [
    '[pages/index]'
  ],
  '/posts': [
    '[pages/posts]',
    '[pages/posts/index]'
  ],
  '/posts/': [
    '[pages/posts]',
    '[pages/posts/index]'
  ],
  '/posts/foo': [
    '[pages/posts]',
    '[pages/posts/_slug]'
  ],
  '/posts/foo/': [
    '[pages/posts]',
    '[pages/posts/_slug]'
  ]
})
