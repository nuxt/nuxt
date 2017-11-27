<template>
  <div class="doughnut-chart">
    <doughnut-chart :data="doughnutChartData" :options="{ legend: { display: false }, maintainAspectRatio: false }"/>
  </div>
</template>

<script>
import DoughnutChart from '~/components/doughnut-chart'
import axios from 'axios'

function getRandomColor() {
  var letters = '0123456789ABCDEF'
  var color = '#'
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

export default {
  async asyncData({ env }) {
    const res = await axios.get(`https://api.github.com/repos/nuxt/nuxt.js/stats/contributors?access_token=${env.githubToken}`)
    return {
      doughnutChartData: {
        labels: res.data.map((stat) => stat.author.login),
        datasets: [
          {
            label: 'Nuxt.js Contributors',
            backgroundColor: res.data.map(() => getRandomColor()),
            data: res.data.map((stat) => 1)
          }
        ]
      }
    }
  },
  components: {
    DoughnutChart
  }
}
</script>

<style scoped>
.doughnut-chart {
  position: fixed;
  left: 10%;
  top: 10%;
  width: 80%;
  height: 80%;
}
</style>
