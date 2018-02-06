import {
  nStoriesOfWithDefault,
  action,
  boolean,
  text,
  color,
  array
} from './storybase.js'

import LineChart from '~/components/LineChart'

nStoriesOfWithDefault({ LineChart })
  .add('with some data', () => ({
    components: { LineChart },
    template: `
<div>
  <line-chart :data="{
    labels: [1,2,3],
    datasets: [
      {
        label: 'Sample',
        backgroundColor: 'green',
        data: ['1','2','3']
      }
    ]
  }" :options="{ maintainAspectRatio: false, responsive:true}"/>
</div>`
  }))
  .add('with knobs demo', () => {
    const maintainAspectRatio = boolean('Aspect Ratio', false)
    const responsive = boolean('Responsive', true)
    const title = text('Title', 'Sample chart')
    const myColor = color('Background Color', 'darkred')

    const defaultValue = array('Values', [1, 2, 3, 6, 3, 8])
    const defaultLabel = array('Labels', [
      "'a'",
      "'b'",
      "'c'",
      "'d'",
      "'e'",
      "'f'"
    ])

    return {
      components: { LineChart },
      methods: { onResize: action('resized') },
      template: `
        <div  style="position: relative; height:40vh; width:80vw">
        <line-chart :data="{
            labels: [${defaultLabel}],
          datasets: [
            {
              label: '${title}',
              backgroundColor: '${myColor}',
              data: [${defaultValue}]
            }
          ]
        }" :options="{ maintainAspectRatio: ${maintainAspectRatio}, responsive:${responsive}, onResize }"/>
      </div>
      `
    }
  })
  .addVT('with Vuetify', () => {
    const data = { "'a'": 1, "'b'": 2, "'c'": 3 }
    return `
        <line-chart :data="{
          labels: [${Object.keys(data)}],
          datasets: [
            {
              label: 'list 1',
              backgroundColor: '#41b883',
              data: [${Object.values(data)}]
            }
          ]
        }" :options="{ maintainAspectRatio: false, responsive:true}"/>
  `
  })
  .addVT(
    'with Vuetify2',
    `<line-chart :data="{
          labels: [1,2,3],
          datasets: [
            {
              label: 'list 2',
              backgroundColor: '#41b883',
              data: ['1','2','3']
            }
          ]
        }" :options="{ maintainAspectRatio: false, responsive:true}"/>
  `
  )
