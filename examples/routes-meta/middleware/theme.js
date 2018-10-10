export default ({ route, store }) => {
  // Take the last value (latest route child)
  const theme = route.meta.reduce((theme, meta) => meta.theme || theme, 'light')
  store.commit('SET_THEME', theme)
}
