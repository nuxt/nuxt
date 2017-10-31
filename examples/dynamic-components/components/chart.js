let VueChart = import('vue-chartjs' /* webpackChunkName: "vue-chartjs" */)

export default async () => {
  VueChart = await VueChart

  return VueChart.Bar.extend({
    props: ['data'],
    mounted() {
      this.renderChart(this.data)
    }
  })
}
