<script setup lang="ts">
const hero = {
  headline: 'New release',
  title: 'Ship beautiful products faster',
  description: 'Acme gives your team the building blocks to design, build and launch modern web applications without reinventing the wheel.',
  links: [
    { label: 'Get started', to: '/signup', trailingIcon: 'i-lucide-arrow-right', size: 'xl' as const },
    { label: 'Read the docs', to: '/docs', color: 'neutral' as const, variant: 'subtle' as const, icon: 'i-lucide-book-open', size: 'xl' as const },
  ],
}

const logos = [
  'i-simple-icons-github',
  'i-simple-icons-discord',
  'i-simple-icons-x',
  'i-simple-icons-instagram',
  'i-simple-icons-linkedin',
  'i-simple-icons-facebook',
  'i-simple-icons-youtube',
  'i-simple-icons-reddit',
]

const features = [
  { icon: 'i-lucide-rocket', title: 'Fast by default', description: 'Server rendered pages, smart prefetching and optimised assets out of the box.' },
  { icon: 'i-lucide-shield-check', title: 'Secure', description: 'Built-in protections against the most common web vulnerabilities.' },
  { icon: 'i-lucide-palette', title: 'Themeable', description: 'Customise every component with design tokens and Tailwind CSS utilities.' },
  { icon: 'i-lucide-accessibility', title: 'Accessible', description: 'Keyboard navigation, focus management and ARIA attributes handled for you.' },
  { icon: 'i-lucide-globe', title: 'Global', description: 'Deploy to the edge and serve users from the closest region automatically.' },
  { icon: 'i-lucide-plug', title: 'Extensible', description: 'A rich ecosystem of modules and integrations to plug into your stack.' },
]

const sections = [
  {
    headline: 'Workflow',
    title: 'Everything your team needs',
    description: 'From the first prototype to production traffic, Acme scales with you.',
    features: [
      { icon: 'i-lucide-git-branch', title: 'Preview deployments', description: 'Every pull request gets its own URL.' },
      { icon: 'i-lucide-activity', title: 'Observability', description: 'Logs, traces and metrics in a single place.' },
      { icon: 'i-lucide-users', title: 'Collaboration', description: 'Comment, review and ship together.' },
    ],
    links: [{ label: 'Learn more', to: '/workflow', color: 'neutral' as const, variant: 'outline' as const, trailingIcon: 'i-lucide-arrow-right' }],
  },
  {
    headline: 'Developer experience',
    title: 'Built for developers',
    description: 'Type-safe APIs, instant feedback and tooling that stays out of your way.',
    features: [
      { icon: 'i-lucide-code', title: 'TypeScript first', description: 'End-to-end types from the server to the browser.' },
      { icon: 'i-lucide-zap', title: 'Hot module replacement', description: 'See every change instantly without losing state.' },
      { icon: 'i-lucide-terminal', title: 'Powerful CLI', description: 'Scaffold, build and deploy from your terminal.' },
    ],
    links: [{ label: 'View docs', to: '/docs', color: 'neutral' as const, variant: 'outline' as const, trailingIcon: 'i-lucide-arrow-right' }],
    reverse: true,
  },
]

const plans = [
  {
    title: 'Starter',
    description: 'For individuals and side projects.',
    price: '$0',
    billingCycle: '/month',
    features: ['1 project', 'Community support', '1 GB storage', 'Basic analytics'],
    button: { label: 'Start for free', to: '/signup', color: 'neutral' as const, variant: 'subtle' as const },
  },
  {
    title: 'Pro',
    description: 'For growing teams shipping fast.',
    price: '$29',
    discount: '$19',
    billingCycle: '/month',
    badge: 'Most popular',
    highlight: true,
    scale: true,
    features: ['Unlimited projects', 'Priority support', '100 GB storage', 'Advanced analytics', 'Custom domains'],
    button: { label: 'Upgrade to Pro', to: '/signup?plan=pro' },
  },
  {
    title: 'Enterprise',
    description: 'For organisations with advanced needs.',
    price: 'Custom',
    features: ['SSO and SAML', 'Dedicated support', 'Unlimited storage', 'Audit logs', 'SLA'],
    button: { label: 'Contact sales', to: '/contact', color: 'neutral' as const },
  },
]

const testimonials = Array.from({ length: 9 }, (_, i) => ({
  quote: [
    'Acme cut our time to launch in half. The components are polished and the defaults are sensible.',
    'We migrated our entire marketing site in a weekend and our Lighthouse scores went up across the board.',
    'The developer experience is unmatched. Everything just works the way you expect it to.',
  ][i % 3]!,
  user: {
    name: ['Sarah Chen', 'Marcus Johnson', 'Priya Patel', 'Tom Williams', 'Ana García', 'Lukas Müller', 'Yuki Tanaka', 'Olivia Brown', 'Noah Davis'][i]!,
    description: ['CTO at Lumen', 'Lead engineer at Northwind', 'Founder of Kite', 'Designer at Orbit', 'PM at Fable', 'Engineer at Vertex', 'CEO at Mochi', 'Developer at Pine', 'Architect at Quill'][i]!,
    avatar: { src: `/avatars/${i + 1}.svg`, alt: 'Avatar' },
  },
}))

const faq = [
  { label: 'Is there a free plan?', content: 'Yes. The Starter plan is free forever and includes everything you need to get going.' },
  { label: 'Can I change plans later?', content: 'You can upgrade or downgrade at any time from your dashboard. Changes are prorated.' },
  { label: 'Do you offer discounts for non-profits?', content: 'We offer a 50% discount for registered non-profit organisations and educational institutions.' },
  { label: 'Where is my data stored?', content: 'Data is stored in the region of your choice with automatic backups every 24 hours.' },
  { label: 'How do I get support?', content: 'Community support is available on Discord, and paid plans include email and priority support.' },
  { label: 'Can I self-host?', content: 'Enterprise customers can deploy Acme on their own infrastructure with our self-hosted package.' },
]

useSeoMeta({
  title: 'Acme: ship beautiful products faster',
  description: hero.description,
})
</script>

<template>
  <div>
    <UPageHero
      :headline="hero.headline"
      :title="hero.title"
      :description="hero.description"
      :links="hero.links"
    />

    <UPageSection :ui="{ container: 'py-8 sm:py-12 lg:py-12' }">
      <UPageLogos title="Trusted by the best teams">
        <UIcon
          v-for="icon in logos"
          :key="icon"
          :name="icon"
          class="size-10 shrink-0"
        />
      </UPageLogos>
    </UPageSection>

    <UPageSection
      id="features"
      headline="Features"
      title="Everything you need to build modern apps"
      description="A complete toolkit with sensible defaults and room to grow."
    >
      <UPageGrid>
        <UPageCard
          v-for="feature in features"
          :key="feature.title"
          v-bind="feature"
          spotlight
        />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      v-for="section in sections"
      :key="section.title"
      v-bind="section"
      orientation="horizontal"
    >
      <div class="aspect-video rounded-lg bg-elevated ring ring-default" />
    </UPageSection>

    <UPageSection
      id="pricing"
      headline="Pricing"
      title="Simple, transparent pricing"
      description="Start for free and upgrade when you are ready."
    >
      <UPricingPlans
        :plans="plans"
        scale
      />
    </UPageSection>

    <UPageSection
      id="testimonials"
      headline="Testimonials"
      title="Loved by teams everywhere"
    >
      <UPageColumns>
        <UPageCard
          v-for="(testimonial, index) in testimonials"
          :key="index"
          variant="subtle"
          :description="testimonial.quote"
          :ui="{ description: 'before:content-[open-quote] after:content-[close-quote]' }"
        >
          <template #footer>
            <UUser
              v-bind="testimonial.user"
              size="lg"
            />
          </template>
        </UPageCard>
      </UPageColumns>
    </UPageSection>

    <UPageSection
      id="faq"
      headline="FAQ"
      title="Frequently asked questions"
    >
      <UAccordion
        :items="faq"
        type="multiple"
        :default-value="['0']"
        class="max-w-3xl mx-auto"
      />
    </UPageSection>

    <UPageSection>
      <UPageCTA
        title="Ready to get started?"
        description="Join thousands of teams already building with Acme."
        variant="subtle"
        :links="[
          { label: 'Start building', to: '/signup', trailingIcon: 'i-lucide-arrow-right' },
          { label: 'Talk to sales', to: '/contact', color: 'neutral', variant: 'subtle' },
        ]"
      />
    </UPageSection>
  </div>
</template>
