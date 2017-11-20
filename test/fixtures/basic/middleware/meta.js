export default ({ store, route, redirect }) => {
  store.commit('setMeta', route.meta)
}
