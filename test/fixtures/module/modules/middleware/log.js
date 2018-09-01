export default function (req, res, next) {
  // eslint-disable-next-line no-console
  console.log(req.url)
  next()
}
