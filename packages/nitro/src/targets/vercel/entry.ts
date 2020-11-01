// @ts-ignore
import { render } from '~runtime/server'

module.exports = (req, res) => {
  const start = process.hrtime()
  render(req.url).then((html) => {
    const end = process.hrtime(start)
    const time = ((end[0] * 1e9) + end[1]) / 1e6
    // @ts-ignore
    res.setHeader('X-Nuxt-Coldstart', global._coldstart + 'ms')
    res.setHeader('X-Nuxt-Responsetime', time + 'ms')

    res.end(html)
  }).catch((err) => {
    console.error(err)
    res.end('Error: ' + err)
  })
}
