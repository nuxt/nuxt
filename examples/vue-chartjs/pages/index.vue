<template>
  <div class="bar-chart">
    <BarChart :data="barChartData" :options="{ maintainAspectRatio: false }" />
  </div>
</template>

<script>
import moment from 'moment'
import BarChart from '~/components/bar-chart'

export default {
  components: {
    BarChart
  },
  async asyncData ({ env, $http, $dayjs }) {
    const stats = await $http.$get('https://api.github.com/repos/nuxt/nuxt.js/stats/commit_activity', {
      headers: {
        Authorization: `token ${env.githubToken}`
      }
    })
    return {
      barChartData: {
        labels: stats.map(stat => moment(stat.week * 1000).format('GGGG[-W]WW')),
        datasets: [
          {
            label: 'Nuxt.js Commit Activity',
            backgroundColor: '#41B38A',
            data: stats.map(stat => stat.total)
          }
        ]
      }
    }
  }
}
</script>

<style scoped>
.bar-chart {
  width: 80%;
  height: 80%;
  margin: auto;
  margin-top: 30px;
}
</style>
