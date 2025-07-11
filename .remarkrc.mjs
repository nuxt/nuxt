export default {
  plugins: [
    'remark-lint',
    [
      'remark-lint-heading-capitalization',
      {
        lowerCaseWords: [
          'about',
          'among',
          'at',
          'before',
          'below',
          'by',
          'for',
          'from',
          'in',
          'of',
          'on',
          'out',
          'over',
          'to',
          'with',
        ],
      },
    ],
  ],
}
