import puppeteer from 'puppeteer'

export default class Browser {
  async start(options = {}) {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
    this.browser = await puppeteer.launch(
      Object.assign(
        {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
        },
        options
      )
    )
  }

  async close() {
    if (!this.browser) return
    await this.browser.close()
  }

  async page(url) {
    if (!this.browser) throw new Error('Please call start() before page(url)')
    const page = await this.browser.newPage()
    await page.goto(url)
    await page.waitForFunction('!!window.$nuxt')
    page.html = () =>
      page.evaluate(() => window.document.documentElement.outerHTML)
    page.$text = selector => page.$eval(selector, el => el.textContent)
    page.$$text = selector =>
      page.$$eval(selector, els => els.map(el => el.textContent))
    page.$attr = (selector, attr) =>
      page.$eval(selector, (el, attr) => el.getAttribute(attr), attr)
    page.$$attr = (selector, attr) =>
      page.$$eval(
        selector,
        (els, attr) => els.map(el => el.getAttribute(attr)),
        attr
      )
    page.$nuxt = await page.evaluateHandle('window.$nuxt')

    page.nuxt = {
      async navigate(path, waitEnd = true) {
        const hook = page.evaluate(() => {
          return new Promise(resolve =>
            window.$nuxt.$once('routeChanged', resolve)
          ).then(() => new Promise(resolve => setTimeout(resolve, 50)))
        })
        await page.evaluate(
          ($nuxt, path) => $nuxt.$router.push(path),
          page.$nuxt,
          path
        )
        if (waitEnd) await hook
        return { hook }
      },
      routeData() {
        return page.evaluate(($nuxt) => {
          return {
            path: $nuxt.$route.path,
            query: $nuxt.$route.query
          }
        }, page.$nuxt)
      },
      loadingData() {
        return page.evaluate($nuxt => $nuxt.$loading.$data, page.$nuxt)
      },
      errorData() {
        return page.evaluate($nuxt => $nuxt.nuxt.err, page.$nuxt)
      },
      storeState() {
        return page.evaluate($nuxt => $nuxt.$store.state, page.$nuxt)
      }
    }
    return page
  }
}
