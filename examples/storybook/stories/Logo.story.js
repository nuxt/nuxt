import {
  nStoriesOf,
  // action,
  // boolean,
  // text,
  // color,
  // array,
  object
} from './storybase.js'

import Logo from '~/components/Logo.vue'

// nStoriesOf({ Logo }, "Logo 1")
// .addDecorator(story => (
//   <div style={{textAlign: 'center'}}>
//     {story()}
//   </div>
// ))
//   .add("with some data", () => ({
//     components: { Logo },
//     template: `
//   <logo :data="{  }  "/>`
//   }))

nStoriesOf({ Logo }, 'Logo ')
  .add('with some data', () => ({
    components: { Logo },
    template: `
       <v-app dark style="min-width:400px">
      <v-container  fill-height>
      <v-flex xs12>
  <logo :data="{  }  "/>
  </v-flex>
  </v-container></v-app>`
  }))
  .addVT('with App layout', '<logo :data="{  }  "/>')
  .addVT('with a knob', () => {
    const data = JSON.stringify(
      object('Data', {
        name: 'Apple',
        count: 132
      })
    )
    return `<logo  :data='${data}' />`
  })
