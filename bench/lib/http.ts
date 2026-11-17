const HEADERS = { accept: 'text/html,application/xhtml+xml' }

/** Fetches a rendered page like a browser would and rejects anything but a successful render. */
export async function fetchDocument (url: string, match: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS })
  const body = await response.text()
  if (!response.ok || !body.includes(match)) {
    throw new Error(`unexpected ${response.status} response from ${url}`)
  }
  return body
}
