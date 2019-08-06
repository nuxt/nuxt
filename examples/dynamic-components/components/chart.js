import { Bar } from 'vue-chartjs'

export default {
  extends: Bar,
  props: ['data'],
  mounted () {
    this.renderChart(this.data)
  }
}
