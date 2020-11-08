/**
 * NuxtOptionsHead
 * Documentation: https://nuxtjs.org/api/configuration-head
 *                https://github.com/declandewet/vue-meta#recognized-metainfo-properties
 */

import { MetaInfo } from 'vue-meta'

export type NuxtOptionsHead = MetaInfo | (() => MetaInfo)
