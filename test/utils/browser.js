import puppeteer from 'puppeteer-core'

import ChromeDetector from './chrome'

export default class Browser {
  constructor () {
    this.detector = new ChromeDetector()
  }

  async start (options = {}) {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
    const _opts = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      ...options
    }

    if (!_opts.executablePath) {
      _opts.executablePath = this.detector.detect()
    }

    this.browser = await puppeteer.launch(_opts)
  }

  async close () {
    if (!this.browser) { return }
    await this.browser.close()
  }

  async page (url, globalName = 'nuxt') {
    if (!this.browser) { throw new Error('Please call start() before page(url)') }
    const page = await this.browser.newPage()
    await page.goto(url)
    page.$nuxtGlobalHandle = `window.$${globalName}`
    await page.waitForFunction(`!!${page.$nuxtGlobalHandle}`)
    page.html = () =>
      page.evaluate(() => window.document.documentElement.outerHTML)
    page.$text = (selector, trim) => page.$eval(selector, (el, trim) => {
      return trim ? el.textContent.replace(/^\s+|\s+$/g, '') : el.textContent
    }, trim)
    page.$$text = (selector, trim) =>
      page.$$eval(selector, (els, trim) => els.map((el) => {
        return trim ? el.textContent.replace(/^\s+|\s+$/g, '') : el.textContent
      }), trim)
    page.$attr = (selector, attr) =>
      page.$eval(selector, (el, attr) => el.getAttribute(attr), attr)
    page.$$attr = (selector, attr) =>
      page.$$eval(
        selector,
        (els, attr) => els.map(el => el.getAttribute(attr)),
        attr
      )

    page.$nuxt = await page.evaluateHandle(page.$nuxtGlobalHandle)

    page.nuxt = {
      async navigate (path, waitEnd = true) {
        const hook = page.evaluate(`
          new Promise(resolve =>
            ${page.$nuxtGlobalHandle}.$once('routeChanged', resolve)
          ).then(() => new Promise(resolve => setTimeout(resolve, 50)))
        `)
        await page.evaluate(
          ($nuxt, path) => $nuxt.$router.push(path),
          page.$nuxt,
          path
        )
        if (waitEnd) {
          await hook
        }
        return { hook }
      },
      async go (n, waitEnd = true) {
        const hook = page.evaluate(`
          new Promise(resolve =>
            ${page.$nuxtGlobalHandle}.$once('routeChanged', resolve)
          ).then(() => new Promise(resolve => setTimeout(resolve, 50)))
        `)
        await page.evaluate(
          ($nuxt, n) => $nuxt.$router.go(n),
          page.$nuxt,
          n
        )
        if (waitEnd) {
          await hook
        }
        return { hook }
      },
      routeData () {
        return page.evaluate(($nuxt) => {
          return {
            path: $nuxt.$route.path,
            query: $nuxt.$route.query
          }
        }, page.$nuxt)
      },
      loadingData () {
        return page.evaluate($nuxt => $nuxt.$loading.$data, page.$nuxt)
      },
      errorData () {
        return page.evaluate($nuxt => $nuxt.nuxt.err, page.$nuxt)
      },
      storeState () {
        return page.evaluate($nuxt => $nuxt.$store.state, page.$nuxt)
      },
      transitionsData () {
        return page.evaluate($nuxt => $nuxt.nuxt.transitions, page.$nuxt)
      }
    }
    return page
  }
}
