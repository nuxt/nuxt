<script setup lang="ts">
const items = [
  { label: 'Features', to: '#features' },
  { label: 'Pricing', to: '#pricing' },
  { label: 'Testimonials', to: '#testimonials' },
  { label: 'FAQ', to: '#faq' },
  { label: 'Blog', to: '/blog' },
]

const columns = [
  {
    label: 'Product',
    children: [
      { label: 'Features', to: '#features' },
      { label: 'Pricing', to: '#pricing' },
      { label: 'Integrations', to: '/integrations' },
      { label: 'Changelog', to: '/changelog' },
    ],
  },
  {
    label: 'Company',
    children: [
      { label: 'About', to: '/about' },
      { label: 'Careers', to: '/careers' },
      { label: 'Press', to: '/press' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Documentation', to: '/docs' },
      { label: 'Guides', to: '/guides' },
      { label: 'Community', to: 'https://discord.com', target: '_blank' },
      { label: 'Status', to: 'https://status.example.com', target: '_blank' },
    ],
  },
]
</script>

<template>
  <div>
    <UHeader title="Acme">
      <UNavigationMenu
        :items="items"
        variant="link"
      />

      <template #right>
        <UColorModeButton />
        <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          to="https://github.com/nuxt/ui"
          target="_blank"
          aria-label="GitHub"
        />
        <UButton
          label="Sign in"
          color="neutral"
          variant="outline"
          to="/login"
          class="hidden lg:inline-flex"
        />
        <UButton
          label="Get started"
          to="/signup"
          class="hidden lg:inline-flex"
        />
      </template>

      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <USeparator
      icon="i-simple-icons-nuxtdotjs"
      class="h-px"
    />

    <UFooter :ui="{ top: 'border-b border-default' }">
      <template #top>
        <UContainer>
          <UFooterColumns :columns="columns">
            <template #right>
              <UFormField
                name="email"
                label="Subscribe to our newsletter"
                size="lg"
              >
                <UInput
                  type="email"
                  class="w-full"
                  placeholder="Enter your email"
                >
                  <template #trailing>
                    <UButton
                      type="submit"
                      size="xs"
                      color="neutral"
                      label="Subscribe"
                    />
                  </template>
                </UInput>
              </UFormField>
            </template>
          </UFooterColumns>
        </UContainer>
      </template>

      <template #left>
        <p class="text-muted text-sm">
          Copyright © 2026. All rights reserved.
        </p>
      </template>

      <template #right>
        <UButton
          icon="i-simple-icons-discord"
          color="neutral"
          variant="ghost"
          to="https://discord.com"
          target="_blank"
          aria-label="Discord"
        />
        <UButton
          icon="i-simple-icons-x"
          color="neutral"
          variant="ghost"
          to="https://x.com"
          target="_blank"
          aria-label="X"
        />
        <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          to="https://github.com"
          target="_blank"
          aria-label="GitHub"
        />
      </template>
    </UFooter>
  </div>
</template>
