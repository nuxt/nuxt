const DISALLOWED_STATUS_CHARS = /[^\t\u0020-\u007E]/g

/**
 * Clamp a status code to the valid HTTP range, falling back to `defaultStatusCode`.
 *
 * @internal
 */
export function sanitizeStatusCode (statusCode?: string | number, defaultStatusCode = 200): number {
  if (!statusCode) {
    return defaultStatusCode
  }
  if (typeof statusCode === 'string') {
    statusCode = Number(statusCode)
  }
  if (Number.isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
    return defaultStatusCode
  }
  return statusCode
}

/**
 * Strip characters that are not permitted in an HTTP reason phrase.
 *
 * @internal
 */
export function sanitizeStatusMessage (statusMessage = ''): string {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, '')
}
