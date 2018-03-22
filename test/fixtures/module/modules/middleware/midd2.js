export default function (req, res, next) {
  res.setHeader('x-midd-2', 'ok')
  next()
}
