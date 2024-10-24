import type { Head, MergeHead } from '@unhead/schema'

/** @deprecated Extend types from `@unhead/schema` directly. This may be removed in a future minor version. */
export interface HeadAugmentations extends MergeHead {
  // runtime type modifications
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  base?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  link?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  meta?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  style?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  script?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  noscript?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  htmlAttrs?: {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  bodyAttrs?: {}
}

export type MetaObjectRaw = Head<HeadAugmentations>
export type MetaObject = MetaObjectRaw

export type AppHeadMetaObject = MetaObjectRaw & {
  /**
   * The character encoding in which the document is encoded => `<meta charset="<value>" />`
   * @default `'utf-8'`
   */
  charset?: string
  /**
   * Configuration of the viewport (the area of the window in which web content can be seen),
   * mapped to => `<meta name="viewport" content="<value>" />`
   * @default `'width=device-width, initial-scale=1'`
   */
  viewport?: string
}
