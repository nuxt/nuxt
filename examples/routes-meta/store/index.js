export const state = () => ({
  theme: 'light'
})

export const mutations = {
  SET_THEME (state, theme) {
    state.theme = theme
  }
}
