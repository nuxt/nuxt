export default defineEventHandler(event => `Hello world (${event.req.url.substr(1)}) (Generated at ${new Date().toUTCString()})`)
