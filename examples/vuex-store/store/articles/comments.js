export const state = () => ({
  list: [
    'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.',
    'Lorem ipsum dolor sit amet, consetetur sadipscing elit.',
    'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.'
  ]
})

export const getters = {
  get (state) {
    return state.list
  }
}
