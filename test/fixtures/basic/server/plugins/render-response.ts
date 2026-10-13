import { getQuery } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    if (!('render-response' in getQuery(event))) { return }

    response.headers['x-render-response'] = JSON.stringify({
      body: typeof response.body,
      html: typeof response.body === 'string' && response.body.includes('</html>'),
      contentType: response.headers['content-type'],
    })
    delete response.headers['x-powered-by']
    response.statusCode = 203
    if (typeof response.body === 'string') {
      response.body = response.body.replace('</body>', '<!--render:response--></body>')
    }
  })
})
