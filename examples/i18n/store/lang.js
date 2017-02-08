import axios from '~plugins/axios'

export const state = {
  locales: ['en', 'fr'], // available langages
  lang: null, // current lang
  _: {} // store for translations
}

export const mutations = {
  SET_LANG (state, lang) {
    state.lang = lang
  },
  SET_TRANSLATION (state, translation) {
    state._[state.lang] = translation
  }
}

export const actions = {
  async setLang ({ state, commit }, lang) {
    if (state._[lang]) {
      return commit('SET_LANG', lang)
    }
    let res = await axios.get(`/locales/${lang}.json`)
    commit('SET_LANG', lang)
    commit('SET_TRANSLATION', res.data)
  }
}
