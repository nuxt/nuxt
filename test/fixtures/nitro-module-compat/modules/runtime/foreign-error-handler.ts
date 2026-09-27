import { defineEventHandler, getQuery } from 'h3'

// an h3 v1 error bundled into a module's own output: not an `HTTPError` instance, so it is
// recognised by the static h3 v1 set on its own error class
class BundledH3Error extends Error {
  static __h3_error__ = true
  statusCode = 404
  statusMessage = 'Not Found'
  data = { from: 'bundled-h3' }
}

export default defineEventHandler((event) => {
  if (getQuery(event).plain) {
    // a thrown plain object: h3 v2 would serialise it as a 200 response body
    throw { statusCode: 402, statusMessage: 'Payment Required', data: { from: 'plain-object' } }
  }
  throw new BundledH3Error('nope')
})
