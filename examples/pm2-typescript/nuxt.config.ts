export default {
  hooks: {
    listen: () => {
      process.send('ready')
    }
  }
}
