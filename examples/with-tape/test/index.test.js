import test from 'tape'
import { shallow } from 'vue-test-utils'
import Index from '../pages/index.vue'

test('renders Index.vue correctly', t => {
  t.plan(4)

  const wrapper = shallow(Index, {
    data: {
      name: 'nuxt'
    }
  })

  const button = wrapper.find('button')

  t.equal(
    wrapper.find('h1').text(),
    'Hello nuxt!',
    'renders "Hello nuxt!" text'
  )

  t.equal(
    wrapper.find('h1').hasClass('red'),
    true,
    'h1 has a red class [default]'
  )

  button.trigger('click')

  t.equal(
    wrapper.find('h1').hasClass('blue'),
    true,
    'h1 class changes to blue [after 1st click]'
  )

  button.trigger('click')

  t.equal(
    wrapper.find('h1').hasClass('green'),
    true,
    'h1 class changes to green [after 2nd click]'
  )
})
