// a module dist that bundled h3 v1 into its own output: no `h3` import to rewrite,
// so nothing shims this file and the thrown error reaches Nitro as a foreign one
class BundledH3Error extends Error {
  static __h3_error__ = true
  statusCode = 401
  statusMessage = 'Unauthorized'
  data = { from: 'bundled-h3' }
}

const defineBundledHandler = (handler: (event: unknown) => unknown) => handler

export default defineBundledHandler(() => {
  throw new BundledH3Error('nope')
})
