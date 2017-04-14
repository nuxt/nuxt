export default function ({ i18n, store, route, params, error, redirect }) {
  const locale = params.lang || 'en'
  if (store.state.locales.indexOf(locale) === -1) {
    return error({ message: 'This page could not be found.', statusCode: 404 })
  }
  // Set locale
  store.commit('SET_LANG', locale)
  i18n.locale = store.state.locale
  // If route is /en/... -> redirect to /...
  if (locale === 'en' && route.fullPath.indexOf('/en') === 0) {
    redirect(route.fullPath.replace(/^\/en/, '/'))
  }
}
