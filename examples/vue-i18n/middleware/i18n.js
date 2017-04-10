export default function ({ app, store, params, error }) {
  const locale = params.lang || 'en-US'
  store.commit('SET_LANG', locale)
  app.$i18n.locale = store.state.locale
}
