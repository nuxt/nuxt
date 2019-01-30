export default function () {
  return function (req, res, next) {
    if (req.ip === undefined) {
      req.ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.info.remoteAddress
    }
    next()
  }
}
