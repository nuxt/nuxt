import { createError } from 'h3'
import { withoutTrailingSlash, withLeadingSlash, parseURL } from 'ufo'
// @ts-ignore
import { getAsset, readAsset } from '~static'

const METHODS = ['HEAD', 'GET']
const PUBLIC_PATH = process.env.PUBLIC_PATH // Default: /_nuxt/
const TWO_DAYS = 2 * 60 * 60 * 24

// eslint-disable-next-line
export default async function serveStatic(req, res) {
  if (!METHODS.includes(req.method)) {
    return
  }

  let id = withLeadingSlash(withoutTrailingSlash(parseURL(req.url).pathname))
  let asset = getAsset(id)

  // Try index.html
  if (!asset) {
    const _id = id + '/index.html'
    const _asset = getAsset(_id)
    if (_asset) {
      asset = _asset
      id = _id
    }
  }

  if (!asset) {
    if (id.startsWith(PUBLIC_PATH)) {
      throw createError({
        message: 'Asset not found: ' + id,
        statusCode: 404
      })
    }
    return
  }

  const ifNotMatch = req.headers['if-none-match'] === asset.etag
  if (ifNotMatch) {
    res.statusCode = 304
    return res.end('Not Modified (etag)')
  }

  const ifModifiedSinceH = req.headers['if-modified-since']
  if (ifModifiedSinceH && asset.mtime) {
    if (new Date(ifModifiedSinceH) >= new Date(asset.mtime)) {
      res.statusCode = 304
      return res.end('Not Modified (mtime)')
    }
  }

  if (asset.type) {
    res.setHeader('Content-Type', asset.type)
  }

  if (asset.etag) {
    res.setHeader('ETag', asset.etag)
  }

  if (asset.mtime) {
    res.setHeader('Last-Modified', asset.mtime)
  }

  if (id.startsWith(PUBLIC_PATH)) {
    res.setHeader('Cache-Control', `max-age=${TWO_DAYS}, immutable`)
  }

  const contents = await readAsset(id)
  return res.end(contents)
}
