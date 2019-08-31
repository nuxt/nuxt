<template>
  <div class="doughnut-chart">
    <DoughnutChart :data="doughnutChartData" :options="{ legend: { display: false }, maintainAspectRatio: false }" />
  </div>
</template>

<script>
import axios from 'axios'
import DoughnutChart from '~/components/doughnut-chart'

function getRandomColor () {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

export default {
  components: {
    DoughnutChart
  },
  async asyncData ({ env }) {
    const res = await axios.get(`https://api.github.com/repos/nuxt/nuxt.js/stats/contributors?access_token=${env.githubToken}`)
    return {
      doughnutChartData: {
        labels: res.data.map(stat => stat.author.login),
        datasets: [
          {
            label: 'Nuxt.js Contributors',
            backgroundColor: res.data.map(getRandomColor),
            data: res.data.map(() => 1)
          }
        ]
      }
    }
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
