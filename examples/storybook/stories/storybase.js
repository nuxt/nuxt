import { storiesOf } from '@storybook/vue'
import { action } from '@storybook/addon-actions'
import {
  withKnobs,
  text,
  number,
  boolean,
  array,
  select,
  color,
  date,
  object,
  button
} from '@storybook/addon-knobs/vue'
import centered from '@storybook/addon-centered'
import { linkTo } from '@storybook/addon-links'

/**
 * Template function for Vuetify
 * @param {*} cmp  component inside object {cmp}
 * @param {*} cmpStr template string or function returning on
 */
const vtmp = (cmp, cmpStr) => ({
  components: cmp,
  template: `
     <v-app style="min-width:400px">
        <v-container fluid fill-height>
        <v-flex xs12>${cmpStr instanceof Function ? cmpStr() : cmpStr}</v-flex>
        </v-container>
    </v-app>
    `
})
/**
 * Richer aLternative to storiesOf
 * @param {*} cmp
 * @param {*} name
 * @param {*} params
 */
const nStoriesOf = (cmp, name = Object.keys(cmp)[0], params = {}) => {
  const x = storiesOf(name, module)
    .addDecorator(centered)
    .addDecorator(withKnobs)

  if (params.withDefault) {
    x.add('Default', () => ({
      render: h => h(Object.values(cmp)[0])
    }))
  }

  x.addVT = (title, cmpStr) => {
    x.add(title, () => vtmp(cmp, cmpStr))
    return x
  }

  return x
}

/**
 * Stories of which just works
 * @param {*} cmp
 * @param {*} name
 */
const nStoriesOfWithDefault = (cmp, name = Object.keys(cmp)[0]) =>
  nStoriesOf(cmp, name, { withDefault: 'withDefault' })

export {
  nStoriesOf,
  nStoriesOfWithDefault,
  action,
  linkTo,
  withKnobs,
  text,
  number,
  object,
  boolean,
  array,
  select,
  color,
  date,
  button,
  vtmp
}
