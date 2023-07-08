import { h } from 'vue'
import type { Component, RendererNode } from 'vue'
// eslint-disable-next-line
import { isString, isPromise, isArray, isObject } from '@vue/shared'
import destr from 'destr'

/**
 * Internal utility
 *
 * @private
 */
export const _wrapIf = (component: Component, props: any, slots: any) => {
  props = props === true ? {} : props
  return { default: () => props ? h(component, props, slots) : slots.default?.() }
}

// eslint-disable-next-line no-use-before-define
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean }
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>

/**
 * create buffer retrieved from @vue/server-renderer
 *
 * @see https://github.com/vuejs/core/blob/9617dd4b2abc07a5dc40de6e5b759e851b4d0da1/packages/server-renderer/src/render.ts#L57
 * @private
 */
export function createBuffer () {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    getBuffer (): SSRBuffer {
      return buffer
    },
    push (item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true
      }
    }
  }
}

const TRANSLATE_RE = /&(nbsp|amp|quot|lt|gt);/g
const NUMSTR_RE = /&#(\d+);/gi
export function decodeHtmlEntities (html: string) {
  const translateDict = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>'
  } as const
  return html.replace(TRANSLATE_RE, function (_, entity: keyof typeof translateDict) {
    return translateDict[entity]
  }).replace(NUMSTR_RE, function (_, numStr: string) {
    const num = parseInt(numStr, 10)
    return String.fromCharCode(num)
  })
}

/**
 * helper for NuxtIsland to generate a correct array for scoped data
 */
export function vforToArray (source: any): any[] {
  if (isArray(source)) {
    return source
  } else if (isString(source)) {
    return source.split('')
  } else if (typeof source === 'number') {
    if (process.dev && !Number.isInteger(source)) {
      console.warn(`The v-for range expect an integer value but got ${source}.`)
    }
    const array = []
    for (let i = 0; i < source; i++) {
      array[i] = i
    }
    return array
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      return Array.from(source as Iterable<any>, item =>
        item
      )
    } else {
      const keys = Object.keys(source)
      const array = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        array[i] = source[key]
      }
      return array
    }
  }
  return []
}

export function getFragmentHTML (element: RendererNode | null) {
  if (element) {
    if (element.nodeName === '#comment' && element.nodeValue === '[') {
      return getFragmentChildren(element)
    }
    return [element.outerHTML]
  }
  return []
}

function getFragmentChildren (element: RendererNode | null, blocks: string[] = []) {
  if (element && element.nodeName) {
    if (isEndFragment(element)) {
      return blocks
    } else if (!isStartFragment(element)) {
      blocks.push(element.outerHTML)
    }

    getFragmentChildren(element.nextSibling, blocks)
  }
  return blocks
}

function isStartFragment (element: RendererNode) {
  return element.nodeName === '#comment' && element.nodeValue === '['
}

function isEndFragment (element: RendererNode) {
  return element.nodeName === '#comment' && element.nodeValue === ']'
}
const SLOT_PROPS_RE = /<div[^>]*nuxt-ssr-slot-name="([^"]*)" nuxt-ssr-slot-data="([^"]*)"[^/|>]*>/g

export function getSlotProps (html: string) {
  const slotsDivs = html.matchAll(SLOT_PROPS_RE)
  const data: Record<string, any> = {}
  for (const slot of slotsDivs) {
    const [_, slotName, json] = slot
    const slotData = destr(decodeHtmlEntities(json))
    data[slotName] = slotData
  }
  return data
}
