/** Style sources of the `no-scripts` fixture page. Builders differ in minifying colours. */
export const pageStyles = {
  scopedBlock: /#no-scripts-page\[data-v-\w+\]\{color:(?:#0a0b0c|rgb\(10, ?11, ?12\))\}/,
  unscopedBlock: /\.no-scripts-unscoped\{color:(?:#0d0e0f|rgb\(13, ?14, ?15\))\}/,
  importedStylesheet: /\.page-imported-css\{color:(?:#010203|rgb\(1, ?2, ?3\))\}/,
  pageOnlyComponent: /\.no-scripts-only\[data-v-\w+\]\{color:(?:#040506|rgb\(4, ?5, ?6\))\}/,
  sharedComponent: /\.shared-widget\[data-v-\w+\]\{color:(?:#070809|rgb\(7, ?8, ?9\))\}/,
}
