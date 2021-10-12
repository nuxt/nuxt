<template>
  <div v-if="link" class="flex flex-col justify-between d-secondary-text mt-8 mb-4 px-4 sm:px-6 sm:flex-row">
    <a :href="link" target="_blank" rel="noopener" class="flex items-center mb-2 text-sm sm:mb-0 hover:underline">
      <IconEdit class="w-3 h-3 mr-1" />
      <span>
        {{ $t('article.github') }}
      </span>
    </a>

    <span v-if="page.mtime" class="flex items-center text-sm">
      {{ $t('article.updatedAt') }} {{ $d(Date.parse(page.mtime), 'long') }}
    </span>
  </div>
</template>

<script>
// TODO: remove this file when Docus fixed the issue
// wrong generated link due to folders deepness

import { defineComponent, computed } from '@nuxtjs/composition-api'
import { joinURL } from 'ufo'
import { useSettings } from '../../node_modules/@docus/theme/dist/composables/settings'

export default defineComponent({
  props: {
    page: {
      type: Object,
      required: true
    }
  },
  setup (props) {
    const { settings } = useSettings()

    /**
     * Repository URL computed
     */
    const repoUrl = computed(() => joinURL(settings.value.github.url, settings.value.github.repo))

    /**
     * Get a page link computed from a page object.
     */
    const getPageLink = (page) => {
      const link = computed(() => {
        if (!settings.value.github) { return }

        // TODO: Fix source; regression from split
        const key = page.key.split(':')
        const dir = key.slice(1, key.length - 1).filter(Boolean).join('/')
        const source = key[key.length - 1]

        return [
          repoUrl.value,
          'edit',
          settings.value.github.branch,
          settings.value.github.dir || '',
          settings.value.contentDir,
          dir,
          `${source}`.replace(/^\//g, '')
        ]
          .filter(Boolean)
          .join('/')
      })

      return link
    }

    const link = getPageLink(props.page)

    return {
      link
    }
  }
})
</script>
