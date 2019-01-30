export default function () {
  return function (req, _, next) {
    if (req.ip === undefined) {
      req.ip = req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null)
    }
    next()
  }
}
