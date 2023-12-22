import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, h, ref, } from 'vue'
import { hash } from 'ohash'
import { appendResponseHeader } from 'h3'
import { useHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import { joinURL, withQuery } from 'ufo'

// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { prerenderRoutes, useRequestEvent } from '../composables/ssr'
import { getSlotProps } from './utils'

// @ts-expect-error virtual file
import { remoteComponentIslands, selectiveClient } from '#build/nuxt.config.mjs'

const pKey = '_islandPromises'
const SSR_UID_RE = /nuxt-ssr-component-uid="([^"]*)"/
const UID_ATTR = /nuxt-ssr-component-uid(="([^"]*)")?/
const SLOTNAME_RE = /nuxt-ssr-slot-name="([^"]*)"/g

export default defineComponent({
    name: 'NuxtIsland',
    props: {
        name: {
            type: String,
            required: true
        },
        lazy: Boolean,
        props: {
            type: Object,
            default: () => undefined
        },
        context: {
            type: Object,
            default: () => ({})
        },
        source: {
            type: String,
            default: () => undefined
        },
        dangerouslyLoadClientComponents: {
            type: Boolean,
            default: false
        }
    },
    async setup(props, { slots }) {
        const error = ref<unknown>(null)
        const config = useRuntimeConfig()
        const nuxtApp = useNuxtApp()
        const filteredProps = computed(() => props.props ? Object.fromEntries(Object.entries(props.props).filter(([key]) => !key.startsWith('data-v-'))) : {})
        const hashId = computed(() => hash([props.name, filteredProps.value, props.context, props.source]))
        const event = useRequestEvent()


        function setPayload(key: string, result: NuxtIslandResponse) {
            nuxtApp.payload.data[key] = {
                __nuxt_island: {
                    key,
                    ...(import.meta.prerender)
                        ? {}
                        : { params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } },
                    result: {
                        chunks: result.chunks,
                        props: result.props,
                        teleports: result.teleports
                    }
                },
                ...result
            }
        }
        const nonReactivePayload: Pick<NuxtIslandResponse, 'chunks' | 'props' | 'teleports'> = {
            chunks: {},
            props: {},
            teleports: {}
        }

        const ssrHTML = ref<string>('')

        const slotProps = computed(() => getSlotProps(ssrHTML.value))
        const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? randomUUID())
        const availableSlots = computed(() => [...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1]))

        function setUid() {
            uid.value = ssrHTML.value.match(SSR_UID_RE)?.[1] ?? randomUUID() as string
        }

        const cHead = ref<Record<'link' | 'style', Array<Record<string, string>>>>({ link: [], style: [] })
        useHead(cHead)

        async function _fetchComponent() {
            const key = `${props.name}_${hashId.value}`

            if (nuxtApp.payload.data[key]?.html) { return nuxtApp.payload.data[key] }

            const url = remoteComponentIslands && props.source ? new URL(`/__nuxt_island/${key}.json`, props.source).href : `/__nuxt_island/${key}.json`

            if (import.meta.prerender) {
                // Hint to Nitro to prerender the island component
                nuxtApp.runWithContext(() => prerenderRoutes(url))
            }

            // TODO: Validate response
            const r = await event.fetch(withQuery((props.source) ? url : joinURL(config.app.baseURL ?? '', url), {
                ...props.context,
                props: props.props ? JSON.stringify(props.props) : undefined
            }))
            const result = await r.json()
            // TODO: support passing on more headers
            if (import.meta.prerender) {
                const hints = r.headers.get('x-nitro-prerender')
                if (hints) {
                    appendResponseHeader(event, 'x-nitro-prerender', hints)
                }
            }
            setPayload(key, result)
            return result
        }

        async function fetchComponent(force = false) {
            nuxtApp[pKey] = nuxtApp[pKey] || {}
            if (!nuxtApp[pKey][uid.value]) {
                nuxtApp[pKey][uid.value] = _fetchComponent().finally(() => {
                    delete nuxtApp[pKey]![uid.value]
                })
            }
            try {
                const res: NuxtIslandResponse = await nuxtApp[pKey][uid.value]
                cHead.value.link = res.head.link
                cHead.value.style = res.head.style
                ssrHTML.value = res.html.replace(UID_ATTR, () => {
                    return `nuxt-ssr-component-uid="${randomUUID()}"`
                })
                nonReactivePayload.teleports = res.teleports
                nonReactivePayload.chunks = res.chunks

                setUid()
            } catch (e) {
                error.value = e
            }
        }

        await fetchComponent()

        return () => {
            if (!ssrHTML.value || error.value) {
                return [slots.fallback?.({ error: error.value }) ?? createVNode('div')]
            }
            const nodes = [createVNode(Fragment, {}, [h(createStaticVNode(ssrHTML.value || '<div></div>', 1))])]

            // render slots and teleports
            if (uid.value && ssrHTML.value) {
                for (const slot in slots) {
                    if (availableSlots.value.includes(slot)) {
                        nodes.push(createVNode(Teleport, { to: `uid=${uid.value};slot=${slot}` }, {
                            default: () => (slotProps.value[slot] ?? [undefined]).map((data: any) => slots[slot]?.(data))
                        }))
                    }
                }
                for (const [id, html] of Object.entries(nonReactivePayload.teleports ?? {})) {
                    nodes.push(createVNode(Teleport, { to: `uid=${uid.value};client=${id}` }, {
                        default: () => [createStaticVNode(html, 1)]
                    }))
                }
            }
            return nodes
        }
    }
})
