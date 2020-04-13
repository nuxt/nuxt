<template>
  <div class="doughnut-chart">
    <DoughnutChart :data="doughnutChartData" :options="{ legend: { display: false }, maintainAspectRatio: false }" />
  </div>
</template>

<script>
import DoughnutChart from '~/components/doughnut-chart'

function isBot (username) {
  return username.includes('[bot]') || username.includes('-bot')
}

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
  async asyncData ({ $http, env }) {
    let contributors = await $http.$get('https://api.github.com/repos/nuxt/nuxt.js/contributors', {
      headers: {
        Authorization: `token ${env.githubToken}`
      }
    })
    contributors = contributors.filter(c => c.contributions >= 10 && !isBot(c.login))
    return {
      doughnutChartData: {
        labels: contributors.map(c => c.login),
        datasets: [
          {
            label: 'Nuxt.js Contributors',
            backgroundColor: contributors.map(getRandomColor),
            data: contributors.map(c => c.contributions)
          }
        ]
      }
    }
  }
}
</script>

<style scoped>
.doughnut-chart {
  width: 80%;
  height: 80%;
  margin: auto;
  margin-top: 30px;
}
</style>
