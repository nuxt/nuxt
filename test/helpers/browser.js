import puppeteer from 'puppeteer'

let browser = null

export async function start(options = {}) {
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
  browser = await puppeteer.launch(Object.assign({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }, options))
}

export async function stop() {
  if (!browser) return
  await browser.close()
}

export async function page(url) {
  if (!browser) throw new Error('Please call start() before page(url)')
  const page = await browser.newPage()
  await page.goto(url)
  await page.waitForFunction('!!window.$nuxt')
  page.html = () => page.evaluate(() => window.document.documentElement.outerHTML)
  page.$text = (selector) => page.$eval(selector, (el) => el.textContent)
  page.$$text = (selector) => page.$$eval(selector, (els) => els.map((el) => el.textContent))
  page.$attr = (selector, attr) => page.$eval(selector, (el, attr) => el.getAttribute(attr), attr)
  page.$$attr = (selector, attr) => page.$$eval(selector, (els, attr) => els.map((el) => el.getAttribute(attr)), attr)
  page.$nuxt = await page.evaluateHandle('window.$nuxt')

  page.nuxt = {
    async navigate(path, wait = false) {
      await page.evaluate(($nuxt, path) => $nuxt.$router.push(path), page.$nuxt, path)
      if (wait) {
        await this.waitForNavigation()
      }
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
      return page.evaluate(($nuxt) => $nuxt.$loading.$data, page.$nuxt)
    },
    errorData() {
      return page.evaluate(($nuxt) => $nuxt.nuxt.err, page.$nuxt)
    },
    storeState() {
      return page.evaluate(($nuxt) => $nuxt.$store.state, page.$nuxt)
    },
    waitForNavigation() {
      return page.waitForFunction('window.$nuxt.$loading.$data.show === false')
    }
  }
  return page
}
