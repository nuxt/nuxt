<template>
  <div class="overflow-hidden relative dark:bg-sky-black dark:text-white pt-12">
    <div class="flex flex-wrap justify-center py-0 section d-container-content">
      <section class="flex flex-col justify-start w-full px-4 pb-24 sm:pt-12 sm:pb-36 lg:pt-24 lg:pb-50 text-center z-20">
        <div class="highlight-box mx-auto mt-6 rounded-md">
          <a href="https://nuxtjs.org/announcements/nuxt3-beta" target="_blank" rel="noopener" class="text-sm inline-flex items-center space-x-1 px-4 md:px-5 py-1 md:py-2 font-medium">
            <span>Read the announcement</span><IconArrowRight class="mt-1px" />
          </a>
        </div>
        <Gem class="block m-x-auto" />
        <h1 class="font-normal font-serif text-display-5 xs:text-display-4 md:text-display-3 2xl:text-display-2 mb-6 pt-2">
          <Markdown use="title" unwrap="p" />
        </h1>
        <h2
          class="
            font-normal
            text-body-base
            xs:text-body-lg
            md:text-body-xl
            2xl:text-body-2xl
            mb-8
            px-8
            sm:px-0
            dark:text-cloud-lighter
            text-cloud-darker
          "
        >
          <Markdown use="description" unwrap="p" />
        </h2>
        <div
          class="
            flex flex-col
            sm:flex-row
            flex-wrap
            items-center
            justify-center
            space-y-3
            sm:space-y-0 sm:space-x-3
            xl:space-x-4
          "
        >
          <SectionButton
            :href="primary.url"
            :aria-label="primary.text"
            size="lg"
            class="dark:bg-sky-black dark:hover:bg-sky-darker hover:bg-cloud-surface"
            :icon-left="primary.icon"
          >
            {{ primary.text }}
          </SectionButton>
          <Markdown use="secondary-button" unwrap="p" />
        </div>
      </section>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    primary: {
      type: Object,
      default: () => ({
        text: 'Star on GitHub',
        url: 'https://github.com',
        icon: 'IconGitHub'
      })
    },
    secondary: {
      type: Object,
      default: () => ({
        text: 'Getting started',
        url: '/docs'
      })
    }
  }
}
</script>

<style>
.highlight-box {
  @apply transition-shadow duration-300;

  box-shadow: #00DC82AA 0px 0px 8px;

  &:hover {
    box-shadow: #00DC82 0px 0px 16px;
  }
}
</style>
