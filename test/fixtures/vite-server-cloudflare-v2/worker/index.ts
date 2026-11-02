import { fetch as render } from '#server-entry'

export default {
  fetch (request: Request): Promise<Response> | Response {
    const url = new URL(request.url)

    if (url.pathname === '/api/hello') {
      return Response.json({ message: 'hello from the worker' })
    }

    if (url.pathname === '/api/throw') {
      throw new Error('boom from the worker')
    }

    return render(request)
  },
}
