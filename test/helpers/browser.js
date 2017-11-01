import puppeteer from 'puppeteer'

let browser = null

export async function start() {
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
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
  page.$nuxt = await page.evaluateHandle('window.$nuxt')

  page.nuxt = {
    async navigate(path, wait = false) {
      await page.evaluate(($nuxt, path) => $nuxt.$router.push(path), page.$nuxt, path)
      if (wait) {
        await this.waitForNavigation()
      }
    },
    loadingData() {
      return page.evaluate(($nuxt) => $nuxt.$loading.$data, page.$nuxt)
    },
    waitForNavigation() {
      return page.waitForFunction('window.$nuxt.$loading.$data.show === false')
    }
  }
  return page
}
