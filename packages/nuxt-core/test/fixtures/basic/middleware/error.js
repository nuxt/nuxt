export default function ({ error }) {
  error({ message: 'Middleware Error', statusCode: 505 })
}
