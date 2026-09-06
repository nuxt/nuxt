export default function hello (_request: Request): Response {
  return Response.json({ message: 'hello from the function' })
}

export const config = {
  path: '/api/hello',
}
