<script setup lang="ts">
const titles = [
  'Introducing Acme 2.0',
  'How we cut our build times in half',
  'Designing for accessibility from day one',
  'A deep dive into edge rendering',
  'Scaling Postgres to a billion rows',
  'What we learned shipping a design system',
  'Type-safe APIs without the boilerplate',
  'Observability for frontend teams',
  'The road to our first million users',
  'Building offline-first web apps',
  'Migrating a monolith to modules',
  'Our approach to open source',
]

const posts = titles.map((title, i) => ({
  title,
  description: 'A look behind the scenes at how the Acme team approaches building products that scale, with lessons learned along the way.',
  date: new Date(Date.UTC(2026, 0, 1 + i * 9)).toISOString().slice(0, 10),
  image: `/avatars/${(i % 9) + 1}.svg`,
  badge: i % 3 === 0 ? 'Release' : i % 3 === 1 ? 'Engineering' : 'Design',
  to: `/blog/${i + 1}`,
  authors: [
    { name: ['Sarah Chen', 'Marcus Johnson', 'Priya Patel'][i % 3]!, avatar: { src: `/avatars/${(i % 9) + 1}.svg`, alt: 'Avatar' }, description: 'Engineering' },
  ],
}))

useSeoMeta({
  title: 'Blog | Acme',
  description: 'News, product updates and engineering stories from the Acme team.',
})
</script>

<template>
  <div>
    <UPageHero
      title="Blog"
      description="News, product updates and engineering stories from the Acme team."
    />

    <UPageSection>
      <UBlogPosts>
        <UBlogPost
          v-for="post in posts"
          :key="post.to"
          v-bind="post"
        />
      </UBlogPosts>
    </UPageSection>
  </div>
</template>
