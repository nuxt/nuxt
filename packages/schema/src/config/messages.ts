import { SchemaDefinition } from 'untyped'

/**
 * @version 2
 */
export default <SchemaDefinition> {
  /** The text that displays on the Nuxt loading indicator when `ssr: false`. */
  loading: 'Loading...',
  /** The 404 text on the default Nuxt error page. */
  error_404: 'This page could not be found',
  /** The text to display on the default Nuxt error page when there has been a server error. */
  server_error: 'Server error',
  /** The text (linked to nuxtjs.org) that appears on the built-in Nuxt error page. */
  nuxtjs: 'Nuxt',
  /** The text (linked to the home page) that appears on the built-in Nuxt error page. */
  back_to_home: 'Back to the home page',
  /** The message that will display on a white screen if the built-in Nuxt error page can't be rendered. */
  server_error_details: 'An error occurred in the application and your page could not be served. If you are the application owner, check your logs for details.',
  /** The default error title (if there isn't a specific error message) on the built-in Nuxt error page. */
  client_error: 'Error',
  /** The error message (in debug mode) on the built-in Nuxt error page. */
  client_error_details: 'An error occurred while rendering the page. Check developer tools console for details.'
}
