module.exports = {
  launch: {
    headless: process.env.HEADLESS !== 'false'
  },
  server: {
    command: 'npm run testServer',
    port: 3000,
    launchTimeout: 50000
  }
}
