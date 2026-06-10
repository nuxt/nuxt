import type { NuxtIslandResponse, NuxtSSRContext } from 'nuxt/app'
// @ts-expect-error virtual file
import { appRootTag } from '#internal/nuxt.config.mjs'

const ROOT_NODE_REGEX = new RegExp(`^<${appRootTag}[^>]*>([\\s\\S]*)<\\/${appRootTag}>$`)

/**
 * remove the root node from the html body
 */
export function getServerComponentHTML (body: string): string {
  const match = body.match(ROOT_NODE_REGEX)
  return match?.[1] || body
}

const SSR_SLOT_TELEPORT_MARKER = /^uid=([^;]*);slot=(.*)$/
const SSR_CLIENT_TELEPORT_MARKER = /^uid=([^;]*);client=(.*)$/
const SSR_CLIENT_SLOT_MARKER = /^island-slot=([^;]*);(.*)$/

export function getSlotIslandResponse (ssrContext: NuxtSSRContext): NuxtIslandResponse['slots'] {
  if (!ssrContext.islandContext || !Object.keys(ssrContext.islandContext.slots).length) { return undefined }
  const response: NuxtIslandResponse['slots'] = {}
  for (const [name, slot] of Object.entries(ssrContext.islandContext.slots)) {
    response[name] = {
      ...slot,
      fallback: ssrContext.teleports?.[`island-fallback=${name}`],
    }
  }
  return response
}

export function getClientIslandResponse (ssrContext: NuxtSSRContext): NuxtIslandResponse['components'] {
  if (!ssrContext.islandContext || !Object.keys(ssrContext.islandContext.components).length) { return undefined }
  const response: NuxtIslandResponse['components'] = {}

  for (const [clientUid, component] of Object.entries(ssrContext.islandContext.components)) {
    // remove teleport anchor to avoid hydration issues
    const html = ssrContext.teleports?.[clientUid]?.replaceAll('<!--teleport start anchor-->', '') || ''
    response[clientUid] = {
      ...component,
      html,
      slots: getComponentSlotTeleport(clientUid, ssrContext.teleports ?? {}),
    }
  }
  return response
}

export function getComponentSlotTeleport (clientUid: string, teleports: Record<string, string>): Record<string, string> {
  const entries = Object.entries(teleports)
  const slots: Record<string, string> = {}

  for (const [key, value] of entries) {
    const match = key.match(SSR_CLIENT_SLOT_MARKER)
    if (match) {
      const [, id, slot] = match
      if (!slot || clientUid !== id) { continue }
      slots[slot] = value
    }
  }
  return slots
}

// Inline script that runs synchronously during streaming, before the
// deferred entry module hydrates. It inserts the teleport content as the
// first child of its `data-island-uid` anchor in the live DOM. The
// streamed body has already flushed the anchors, so a post-render string
// pass is not possible.
const ISLAND_TELEPORT_RELOCATE_SCRIPT = `(()=>{for(const t of document.querySelectorAll('template[data-island-uid]')){const u=t.getAttribute('data-island-uid'),s=t.getAttribute('data-island-slot'),c=t.getAttribute('data-island-component'),a=document.querySelector('[data-island-uid="'+u+'"]'+(s!==null?'[data-island-slot="'+s+'"]':'[data-island-component="'+c+'"]'));if(a){a.insertBefore(t.content,a.firstChild)}t.remove()}})()`

/**
 * Emit each island teleport as an inert `<template>` keyed by its anchor,
 * followed by a relocation script that moves the content into place before
 * hydration. Returns an empty string when there are no island teleports.
 */
export function renderStreamedIslandTeleports (ssrContext: NuxtSSRContext, nonceAttr = ''): string {
  const { teleports, islandContext } = ssrContext

  if (islandContext || !teleports) { return '' }
  let templates = ''
  for (const key in teleports) {
    const matchClientComp = key.match(SSR_CLIENT_TELEPORT_MARKER)
    if (matchClientComp) {
      const [, uid, clientId] = matchClientComp
      if (!uid || !clientId) { continue }
      templates += `<template data-island-uid="${uid}" data-island-component="${clientId}">${teleports[key]}</template>`
      continue
    }
    const matchSlot = key.match(SSR_SLOT_TELEPORT_MARKER)
    if (matchSlot) {
      const [, uid, slot] = matchSlot
      if (!uid || !slot) { continue }
      templates += `<template data-island-uid="${uid}" data-island-slot="${slot}">${teleports[key]}</template>`
    }
  }
  if (!templates) { return '' }
  return templates + `<script${nonceAttr}>${ISLAND_TELEPORT_RELOCATE_SCRIPT}</script>`
}

export function replaceIslandTeleports (ssrContext: NuxtSSRContext, html: string): string {
  const { teleports, islandContext } = ssrContext

  if (islandContext || !teleports) { return html }
  for (const key in teleports) {
    const matchClientComp = key.match(SSR_CLIENT_TELEPORT_MARKER)
    if (matchClientComp) {
      const [, uid, clientId] = matchClientComp
      if (!uid || !clientId) { continue }
      html = html.replace(new RegExp(` data-island-uid="${uid}" data-island-component="${clientId}"[^>]*>`), (full) => {
        return full + teleports[key]
      })
      continue
    }
    const matchSlot = key.match(SSR_SLOT_TELEPORT_MARKER)
    if (matchSlot) {
      const [, uid, slot] = matchSlot
      if (!uid || !slot) { continue }
      html = html.replace(new RegExp(` data-island-uid="${uid}" data-island-slot="${slot}"[^>]*>`), (full) => {
        return full + teleports[key]
      })
    }
  }
  return html
}
