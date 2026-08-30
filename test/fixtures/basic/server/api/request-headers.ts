export default defineEventHandler(event => ({
  cookie: event.req.headers.get('cookie'),
  authorization: event.req.headers.get('authorization'),
  accept: event.req.headers.get('accept'),
}))
