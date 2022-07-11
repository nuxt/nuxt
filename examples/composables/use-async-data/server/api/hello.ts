export default req => `Hello world (${req.url.substr(1)}) (Generated at ${new Date().toUTCString()})`
