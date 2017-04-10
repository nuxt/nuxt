export const state = {
  locale: 'en-US'
}

export const mutations = {
  SET_LANG (state, locale) {
    if (['en-US', 'fr-FR'].indexOf(locale) !== -1) {
      state.locale = locale
    }
  }
}
