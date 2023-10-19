import http from 'node:http'
export function createSimpleRemoteIslandProvider (port = 3001) {
  const server = http.createServer((req, res) => {
    const response = {
      html: '<div>hello world from another server</div>',
      state: {},
      head: {
        link: [],
        style: []
      }
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(response))
  })

  server.listen(port)

  return server
}
