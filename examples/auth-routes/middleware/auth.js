export default function ({ store, error }) {
  if (!store.state.authUser) {
    error({
      message: 'You are not connected',
      statusCode: 403
    })
  }
}
