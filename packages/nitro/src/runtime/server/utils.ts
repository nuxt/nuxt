const METHOD_WITH_BODY_RE = /post|put|patch/i
const TEXT_MIME_RE = /application\/text|text\/html/
const JSON_MIME_RE = /application\/json/

export function requestHasBody (request: globalThis.Request) : boolean {
  return METHOD_WITH_BODY_RE.test(request.method)
}

export async function useRequestBody (request: globalThis.Request): Promise<any> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('form')) {
    const formData = await request.formData()
    const body = Object.create(null)
    for (const entry of formData.entries()) {
      body[entry[0]] = entry[1]
    }
    return body
  } else if (JSON_MIME_RE.test(contentType)) {
    return request.json()
  } else if (TEXT_MIME_RE.test(contentType)) {
    return request.text()
  } else {
    const blob = await request.blob()
    return URL.createObjectURL(blob)
  }
}
