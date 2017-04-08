module.exports = {
  offline: true, // true or https://github.com/NekR/offline-plugin/blob/master/docs/options.md
  plugins: [
    { src: '~plugins/init-offline.js', ssr: false }
  ]
}
