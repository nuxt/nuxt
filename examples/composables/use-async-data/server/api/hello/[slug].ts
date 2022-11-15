export default defineEventHandler(event => `Hello world (${event.node.req.url.substr(1)}) (Generated at ${new Date().toUTCString()})`)
