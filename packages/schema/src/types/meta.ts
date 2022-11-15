import type { Head, MergeHead } from '@unhead/schema'

export interface HeadAugmentations extends MergeHead {
  // runtime type modifications
  base?: {}
  link?: {}
  meta?: {}
  style?: {}
  script?: {}
  noscript?: {}
  htmlAttrs?: {}
  bodyAttrs?: {}
}

export type MetaObjectRaw = Head<HeadAugmentations>
export type MetaObject = MetaObjectRaw

export type AppHeadMetaObject = MetaObjectRaw & {
  /**
   * The character encoding in which the document is encoded => `<meta charset="<value>" />`
   *
   * @default `'utf-8'`
   */
  charset?: string
  /**
   * Configuration of the viewport (the area of the window in which web content can be seen),
   * mapped to => `<meta name="viewport" content="<value>" />`
   *
   * @default `'width=device-width, initial-scale=1'`
   */
  viewport?: string
}
