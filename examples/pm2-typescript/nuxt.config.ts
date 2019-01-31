export default {
  hooks: {
    listen () {
      if (process.send) {
        process.send('ready')
      }
    }
  }
}
