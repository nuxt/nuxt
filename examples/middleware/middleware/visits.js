export default function ({ store, route, redirect }) {
  store.commit('ADD_VISIT', route.path)
  if (route.fullPath === '/') return redirect('/foo')
}
