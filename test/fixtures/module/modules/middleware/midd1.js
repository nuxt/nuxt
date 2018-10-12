export default function (req, res, next) {
  res.setHeader('x-midd-1', 'ok')
  next()
}
