/* eslint-disable no-console */

const http = require('http')
const express = require('express')
const axios = require('axios')

const nuxtBaseUrl = 'http://localhost:3000'

const app = express()

function proxyRequestToNuxt (req, logger) {
  return new Promise((resolve, reject) => {
    const proxyUrl = `${nuxtBaseUrl}${req.url}`
    console.debug(`Proxying ${req.url} to ${proxyUrl}`)
    const proxyRequest = http.get(proxyUrl, { headers: req.headers }, (res) => {
      const { statusCode, headers } = res
      let buffer = Buffer.alloc(0)
      res.on('error', e => reject(e))
      // eslint-disable-next-line no-return-assign
      res.on('data', chunk => buffer = Buffer.concat([buffer, chunk]))
      res.on('end', () => resolve({ statusCode, headers, buffer }))
    })
    proxyRequest.on('error', e => reject(e))
    proxyRequest.end()
  })
}

async function proxyHandler (req, res) {
  try {
    const response = await proxyRequestToNuxt(req, res.locals.logger)
    res.set(response.headers)
    res.status(response.statusCode).send(response.buffer)
  } catch (e) {
    if (e && e.response) {
      res.set(e.response.headers)
      res.status(e.response.statusCode).send(e.response.buffer)
    } else {
      console.error(e)
      throw new Error('Error proxying response')
    }
  }
}

function renderTemplate (headerHtml, footerHtml) {
  return `
<!DOCTYPE html>
<html>
  <head>
      <title>Sample App</title>
  </head>
  <body>
    ${headerHtml}
    <main>
      <p>This is the body of the page</p>
    </main>
    ${footerHtml}
  </body>
</html>`
}

// These don't seem to handle the long polling aspect
// app.get('/__webpack_hmr/*', proxyHandler);
app.get('/_nuxt/*', proxyHandler)
// app.get('/_loading/*', proxyHandler);

app.get('/', async (req, res) => {
  const headerHtml = await axios.get('http://localhost:3000/orchestrated/header')
  const footerHtml = await axios.get('http://localhost:3000/orchestrated/footer', {
    query: {
      excludeStyles: 1,
      excludeScripts: 1
    }
  })
  const html = renderTemplate(headerHtml.data, footerHtml.data)
  res.send(html)
})

const server = app.listen(3001, () => {
  console.info(`Server listening at http://localhost:${server.address().port}/`)
})
