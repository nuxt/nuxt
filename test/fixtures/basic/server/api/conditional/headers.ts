const CONDITIONAL_HEADERS = ['if-match', 'if-modified-since', 'if-none-match', 'if-range', 'if-unmodified-since', 'range']

export default defineEventHandler(event => Object.fromEntries(CONDITIONAL_HEADERS.map(name => [name, getRequestHeader(event, name) ?? null])))
