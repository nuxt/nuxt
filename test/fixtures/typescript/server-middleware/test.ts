export default {
  path: '/api/test',
  handler(_, res) {
    const message: String = 'Works!'
    res.end(message)
  }
}
