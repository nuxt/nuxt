export interface MetaObject extends Record<string, any> {
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

  /** Each item in the array maps to a newly-created `<meta>` element, where object properties map to attributes. */
  meta?: Array<Record<string, any>>
  /** Each item in the array maps to a newly-created `<link>` element, where object properties map to attributes. */
  link?: Array<Record<string, any>>
  /** Each item in the array maps to a newly-created `<style>` element, where object properties map to attributes. */
  style?: Array<Record<string, any>>
  /** Each item in the array maps to a newly-created `<script>` element, where object properties map to attributes. */
  script?: Array<Record<string, any>>

  titleTemplate?: string | ((title: string) => string)
}
