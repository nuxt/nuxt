<template>
  <div class="bar-chart">
    <bar-chart :data="barChartData" :options="{ maintainAspectRatio: false }"/>
  </div>
</template>

<script>
import BarChart from '~/components/bar-chart'
import axios from 'axios'
import moment from 'moment'

export default {
  async asyncData({ env }) {
    const res = await axios.get(`https://api.github.com/repos/nuxt/nuxt.js/stats/commit_activity?access_token=${env.githubToken}`)
    return {
      barChartData: {
        labels: res.data.map((stat) => moment(stat.week * 1000).format('GGGG[-W]WW')),
        datasets: [
          {
            label: 'Nuxt.js Commit Activity',
            backgroundColor: '#41b883',
            data: res.data.map((stat) => stat.total)
          }
        ]
      }
    }
  },
  components: {
    BarChart
  }
}
</script>

<style scoped>
.bar-chart {
  position: fixed;
  left: 10%;
  top: 10%;
  width: 80%;
  height: 80%;
}
</style>
