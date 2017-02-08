export default async function ({ store, params, error }) {
  const lang = params.lang || 'en'
  if (!store.state.lang.locales.includes(lang)) {
    return error({ message: 'Page not found', statusCode: 404 })
  }
  return store.dispatch('lang/setLang', lang)
}
