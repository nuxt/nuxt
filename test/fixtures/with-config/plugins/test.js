// Custom plugin

if (process.client) {
  window.__test_plugin = true
} else {
  global.__test_plugin = true
}
