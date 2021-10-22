<template>
  <div id="docsearch">
    <button type="button" class="DocSearch DocSearch-Button" aria-label="Search">
      <svg width="20" height="20" class="d-icon m-auto" viewBox="0 0 20 20">
        <path
          d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
          stroke="currentColor"
          fill="none"
          fill-rule="evenodd"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>

<script>
function isSpecialClick(event) {
  return event.button === 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
}

export default {
  props: {
    options: {
      type: Object,
      required: true
    },
    settings: {
      type: Object,
      required: true
    }
  },
  watch: {
    '$i18n.locale'(newValue) {
      this.update(this.options, newValue)
    },
    options(newValue) {
      this.update(newValue, this.$i18n.locale)
    }
  },
  mounted() {
    this.initialize(this.options, this.$i18n.locale)
  },
  methods: {
    stripTrailingSlash(url) {
      return url.replace(/\/$|\/(?=\?)|\/(?=#)/g, '')
    },
    getRelativePath(absoluteUrl) {
      const { pathname, hash } = new URL(absoluteUrl)
      const url = pathname.replace(this.settings.url, '/') + hash
      return this.stripTrailingSlash(url)
    },
    async initialize(userOptions, code) {
      const lang = this.$i18n.locales.find(locale => locale.code === code)

      const docsearch = await Promise.all([
        import(/* webpackChunkName: "docsearch" */ '@docsearch/js'),
        import(/* webpackChunkName: "docsearch" */ '@docsearch/css')
      ]).then(([docsearch]) => docsearch.default)

      docsearch({
        ...userOptions,
        container: '#docsearch',
        searchParameters: {
          ...((!lang) ? {} : {
            facetFilters: [`${userOptions.langAttribute || 'language'}:${lang.iso}`].concat(
              userOptions.facetFilters || []
            )
          }),
        },
        navigator: {
          navigate: ({ itemUrl }) => {
            const { pathname: hitPathname } = new URL(window.location.origin + itemUrl)

            // Vue Router doesn't handle same-page navigation so we use
            // the native browser location API for anchor navigation.
            if (this.$router.history.current.path === hitPathname) {
              window.location.assign(window.location.origin + itemUrl)
            } else {
              this.$router.push(itemUrl)
            }
          }
        },
        transformItems: (items) => {
          return items.map((item) => {
            return {
              ...item,
              url: this.getRelativePath(item.url)
            }
          })
        },
        hitComponent: ({ hit, children }) => {
          return {
            type: 'a',
            constructor: undefined,
            __v: 1,
            props: {
              href: hit.url,
              children: children,
              onClick: (event) => {
                if (isSpecialClick(event)) {
                  return
                }

                // We rely on the native link scrolling when user is
                // already on the right anchor because Vue Router doesn't
                // support duplicated history entries.
                if (this.$router.history.current.fullPath === hit.url) {
                  return
                }

                const { pathname: hitPathname } = new URL(window.location.origin + hit.url)

                // If the hits goes to another page, we prevent the native link behavior
                // to leverage the Vue Router loading feature.
                if (this.$router.history.current.path !== hitPathname) {
                  event.preventDefault()
                }

                this.$router.push(hit.url)
              },
            }
          }
        }
      })
    },
    update(options, lang) {
      return this.initialize(options, lang)
    }
  }
}
</script>

<style lang="postcss">
.DocSearch {
  --docsearch-primary-color: #00dc82;
  --docsearch-highlight-color: var(--docsearch-primary-color);
  --docsearch-text-color: rgb(113, 113, 122);
  --docsearch-modal-background: theme("colors.gray.100");
  --docsearch-searchbox-shadow: 0 0 0 2px var(--docsearch-primary-color);
  --docsearch-searchbox-background: var(--color-transparent);
  --docsearch-searchbox-focus-background: var(--color-transparent);
  --docsearch-hit-color: var(--color-gray-700);
  --docsearch-hit-shadow: none;
  --docsearch-logo-color: var(--docsearch-text-color);
  --docsearch-muted-color: var(--color-gray-500);
  --docsearch-container-background: rgb(244 244 245 / 55%);
}

.dark {
  & .DocSearch {
    --docsearch-text-color: rgb(146, 173, 173);
    --docsearch-modal-background: theme("colors.secondary-darker");
    --docsearch-modal-shadow: inset 1px 1px 0 0 #052f14, 0 3px 8px 0 #0b160d;
    --docsearch-hit-color: var(--color-gray-300);
    --docsearch-hit-background: theme("colors.secondary-darkest");
    --docsearch-footer-background: theme("colors.secondary-darkest");
    --docsearch-footer-shadow: inset 0 1px 0 0 rgba(73, 76, 106, 0.5),
      0 -4px 8px 0 rgba(0, 0, 0, 0.2);
    --docsearch-container-background: rgb(0 30 38 / 64%);
  }
}

.DocSearch-Container {
  @apply blur-8;
}
.DocSearch-Modal {
  @apply lg:rounded-xl !important;
}
.DocSearch-SearchBar {
  @apply pb-1 !important;
}
.DocSearch-Button {
  @apply rounded-sm w-12 h-12 m-auto bg-transparent hover:shadow-none focus:outline-none !important;
}
.DocSearch-Button > svg {
  @apply mx-auto !important;
}
.DocSearch-Button-Key {
  @apply hidden !important;
}
.DocSearch-Button-Placeholder {
  @apply hidden !important;
}
.DocSearch-NoResults > .DocSearch-Screen-Icon > svg {
  @apply mx-auto !important;
}
.DocSearch-Commands-Key {
  @apply inline-flex items-center justify-center w-auto h-auto p-1 bg-none rounded shadow-none border light:border-gray-500 !important;
}
</style>
