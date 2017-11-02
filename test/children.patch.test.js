import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder, Utils } from '../index.js'
import * as browser from './helpers/browser'

const port = 4005
const url = (route) => 'http://localhost:' + port + route

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
test.before('Start browser', async t => {
  await browser.start({
    // slowMo: 50,
    // headless: false
  })
})

let page
const dates = {}

test('Loading /patch and keep ', async t => {
  page = await browser.page(url('/patch'))

  const h1 = await page.$text('h1')
  t.true(h1.includes('patch:'))
  const h2 = await page.$text('h2')
  t.is(h2, 'Index')
  dates.patch = await page.$text('[data-date-patch]')
})

test('Navigate to /patch/1', async t => {
  await page.nuxt.navigate('/patch/1')
  const loading = await page.nuxt.loadingData()
  t.is(loading.show, true)
  await page.nuxt.waitForNavigation()

  const h2 = await page.$text('h2')
  t.true(h2.includes('_id:'))
  dates.id = await page.$text('[data-date-id]')

  t.is(dates.patch, await page.$text('[data-date-patch]'))
})

test('Navigate to /patch/2', async t => {
  await page.nuxt.navigate('/patch/2', true)
  const date = await page.$text('[data-date-id]')

  t.is(await page.$text('h3'), 'Index')
  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.true(+dates.id < +date)
  dates.id = date
})

test('Navigate to /patch/2?test=true', async t => {
  await page.nuxt.navigate('/patch/2?test=true', true)
  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.is(dates.id, await page.$text('[data-date-id]'))
})

test('Navigate to /patch/2#test', async t => {
  await page.nuxt.navigate('/patch/2#test', true)
  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.is(dates.id, await page.$text('[data-date-id]'))
})

test('Navigate to /patch/2/child', async t => {
  await page.nuxt.navigate('/patch/2/child', true)
  dates.child = await page.$text('[data-date-child]')

  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.is(dates.id, await page.$text('[data-date-id]'))
  t.true(+dates.child > +dates.id)
})

test('Navigate to /patch/2/child', async t => {
  await page.nuxt.navigate('/patch/2/child', true)
  dates.child = await page.$text('[data-date-child]')
  dates.slug = await page.$text('[data-date-child-slug]')

  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.is(dates.id, await page.$text('[data-date-id]'))
  t.true(+dates.child > +dates.id)
  t.true(+dates.slug > +dates.child)
})

test('Navigate to /patch/2/child/1', async t => {
  await page.nuxt.navigate('/patch/2/child/1', true)
  const date = await page.$text('[data-date-child-slug]')

  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.is(dates.id, await page.$text('[data-date-id]'))
  t.is(dates.child, await page.$text('[data-date-child]'))
  t.true(+date > +dates.slug)
  dates.slug = date
})

test('Navigate to /patch/2/child/1?foo=bar', async t => {
  await page.nuxt.navigate('/patch/2/child/1?foo=bar', true)

  t.is(dates.patch, await page.$text('[data-date-patch]'))
  t.is(dates.id, await page.$text('[data-date-id]'))
  t.is(dates.child, await page.$text('[data-date-child]'))
  t.is(dates.slug, await page.$text('[data-date-child-slug]'))
})

test('Search a country', async t => {
  const countries = await page.$$text('[data-test-search-result]')
  t.is(countries.length, 5)

  await page.type('[data-test-search-input]', 'gu')

  await Utils.waitFor(100)
  const newCountries = await page.$$text('[data-test-search-result]')
  t.is(newCountries.length, 1)
  t.deepEqual(newCountries, ['Guinea'])
  t.deepEqual(await page.nuxt.routeData(), {
    path: '/patch/2/child/1',
    query: {
      foo: 'bar',
      q: 'gu'
    }
  })
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
test.after('Stop browser', async t => {
  await page.close()
  await browser.stop()
})
