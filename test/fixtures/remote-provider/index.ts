import http from 'node:http'

export const server = http.createServer((req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({
    html: '<div>hello world from another server</div>'
  }))
})
