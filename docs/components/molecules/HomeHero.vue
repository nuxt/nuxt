<template>
  <div class="overflow-hidden relative dark:bg-sky-black dark:text-white pt-12">
    <div class="flex flex-wrap justify-center py-0 section d-container-content">
      <section class="flex flex-col justify-start w-full px-4 pt-36 pb-48 md:pt-44 lg:pb-56 lg:pt-24 text-center z-20">
        <Gem class="block m-x-auto" />
        <h1 class="font-normal font-serif text-display-5 xs:text-display-4 md:text-display-3 2xl:text-display-2 mb-6 pt-8">
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
        text: '38K+ GitHub stars',
        url: '/https://github.com',
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
