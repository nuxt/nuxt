export default function ({ store, route }) {
  store.commit('ADD_VISIT', route.path)
}
