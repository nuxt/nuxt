import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '../index.js'

const port = 4004
// const url = (route) => 'http://localhost:' + port + route

let nuxt = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/children'),
    dev: false
  }
  nuxt = new Nuxt(options)
  await new Builder(nuxt).build()

  await nuxt.listen(port, 'localhost')
})

test('/parent', async t => {
  const { html } = await nuxt.renderRoute('/parent')
  t.true(html.includes('<h1>I am the parent</h1>'))
})

test('/parent/child', async t => {
  const { html } = await nuxt.renderRoute('/parent/child')
  t.true(html.includes('<h1>I am the parent</h1>'))
  t.true(html.includes('<h2>I am the child</h2>'))
})

test('/parent should call _id.vue', async t => {
  const { html } = await nuxt.renderRoute('/parent')
  t.true(html.includes('<h1>I am the parent</h1>'))
  t.true(html.includes('<h2>Id=</h2>'))
})

test('/parent/1', async t => {
  const { html } = await nuxt.renderRoute('/parent/1')
  t.true(html.includes('<h1>I am the parent</h1>'))
  t.true(html.includes('<h2>Id=1</h2>'))
})

test('/parent/validate-child should display 404', async t => {
  const { html } = await nuxt.renderRoute('/parent/validate-child')
  t.true(html.includes('This page could not be found'))
})

test('/parent/validate-child?key=12345', async t => {
  const { html } = await nuxt.renderRoute('/parent/validate-child?key=12345')
  t.true(html.includes('<h1>I am the parent</h1>'))
  t.true(html.includes('<h2>Child valid</h2>'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
