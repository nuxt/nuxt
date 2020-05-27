export default {
  target: 'static',
  export: {
    payload: {
      config: true
    }
  },
  hooks: {
    export: {
      before ({ payload }) {
        payload.shared = true
      },
      route ({ route, payload }) {
        payload.myRoute = route
      }
    }
  }
}
