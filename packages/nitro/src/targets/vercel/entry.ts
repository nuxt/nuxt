// @ts-ignore
import { render } from '~runtime/server'

module.exports = async (req, res) => {
  try {
    const { html, status, headers } = await render(req.url, { req, res })
    for (const header in headers) {
      res.setHeadeer(header, headers[header])
    }
    res.status(status)
    res.end(html)
  } catch (error) {
    console.error(error)
    res.status(500)
    res.end('Internal Error: ' + error)
  }
}
