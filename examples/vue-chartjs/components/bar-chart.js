import { Bar } from 'vue-chartjs'

export default Bar.extend({
  props: ['data', 'options'],
  mounted() {
    this.renderChart(this.data, this.options)
  }
})
