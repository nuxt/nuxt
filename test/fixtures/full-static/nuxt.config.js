export default {
  target: 'static',
  export: {
    config: true
  },
  hooks: {
    generate: {
      before ({ payload }) {
        payload.shared = true
      },
      route ({ route, payload }) {
        payload.myRoute = route
      }
    }
  }
}
