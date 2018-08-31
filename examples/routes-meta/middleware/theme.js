export default ({ route, app }) => {
  // Take the last value (latest route child)
  const theme = route.meta.reduce((theme, meta) => meta.theme || theme, 'light')
  app.store.commit('SET_THEME', theme)
}
