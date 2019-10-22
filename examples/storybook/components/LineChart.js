import { Line } from 'vue-chartjs'

export default {
  extends: Line,
  props: ['data', 'options'],
  mounted () {
    this.renderChart(this.data, this.options)
  }
}
