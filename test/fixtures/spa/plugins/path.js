export default function ({ route }, inject) {
  // Inject route's fullPath as seen initially within the plugin.
  inject('routeFullPath', route.fullPath)
}
