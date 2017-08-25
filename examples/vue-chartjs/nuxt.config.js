module.exports = {
  head: {
    title: 'Nuxt.js + Vue-ChartJS',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  },
  build: {
    vendor: ['axios', 'moment', 'chart.js', 'vue-chartjs']
  },
  env: {
    githubToken: '42cdf9fd55abf41d24f34c0f8a4d9ada5f9e9b93'
  }
}
