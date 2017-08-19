
import { attrsStr } from 'utils'
import LRU from 'lru-cache'

export default class MetaRenderer {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.cache = LRU({})
  }

  render ({ url = '/' }) {
    let head = this.cache.get(url)

    if (head) {
      return head
    }

    head = ''

    // Title
    if (typeof this.options.head.title === 'string') {
      head += `<title data-n-head="true">${this.options.head.title || ''}</title>`
    }

    // Meta
    if (Array.isArray(this.options.head.meta)) {
      this.options.head.meta.forEach(meta => {
        head += `<meta data-n-head="true" ${attrsStr(meta)}/>`
      })
    }

    // Links
    if (Array.isArray(this.options.head.link)) {
      this.options.head.link.forEach(link => {
        head += `<link data-n-head="true" ${attrsStr(link)}/>`
      })
    }

    // Style
    if (Array.isArray(this.options.head.style)) {
      this.options.head.style.forEach(style => {
        head += `<style data-n-head="true" ${attrsStr(style, ['cssText'])}>${style.cssText || ''}</style>`
      })
    }

    // Script
    if (Array.isArray(this.options.head.script)) {
      this.options.head.script.forEach(script => {
        head += `<script data-n-head="true" ${attrsStr(script, ['innerHTML'])}>${script.innerHTML || ''}</script>`
      })
    }

    this.cache.set(url, head)

    return head
  }
}
