import test from 'ava'
const Nuxt = require('../')
const nuxt = new Nuxt()

test('Nuxt.js Class', (t) => {
  t.is(typeof Nuxt, 'function')
})

test('Nuxt.js Instance', (t) => {
  t.is(typeof nuxt, 'object')
  t.is(nuxt.dev, true)
  t.is(typeof nuxt.build, 'function')
  t.is(typeof nuxt.generate, 'function')
})
