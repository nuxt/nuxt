export const featureCLIs = {
  devtools: '@nuxt/devtools-edge@latest'
} as const

export function isFeature (feature: string): feature is keyof typeof featureCLIs {
  return feature in featureCLIs
}
