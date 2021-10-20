import { expect } from 'chai'
import { generateRoutesFromFiles } from '../src/pages/utils'

describe('pages:generateRoutesFromFiles', () => {
  const pagesDir = 'pages'
  const tests = [
    {
      description: 'should generate correct route for 404',
      files: [`${pagesDir}/404.vue`],
      output: [
        {
          name: '404',
          path: '/:catchAll(.*)*',
          file: `${pagesDir}/404.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct routes for index pages',
      files: [
          `${pagesDir}/index.vue`,
          `${pagesDir}/parent/index.vue`,
          `${pagesDir}/parent/child/index.vue`
      ],
      output: [
        {
          name: 'index',
          path: '/',
          file: `${pagesDir}/index.vue`,
          children: []
        },
        {
          name: 'parent',
          path: '/parent',
          file: `${pagesDir}/parent/index.vue`,
          children: []
        },
        {
          name: 'parent-child',
          path: '/parent/child',
          file: `${pagesDir}/parent/child/index.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct routes for parent/child',
      files: [
          `${pagesDir}/parent.vue`,
          `${pagesDir}/parent/child.vue`
      ],
      output: [
        {
          name: 'parent',
          path: '/parent',
          file: `${pagesDir}/parent.vue`,
          children: [
            {
              name: 'parent-child',
              path: 'child',
              file: `${pagesDir}/parent/child.vue`,
              children: []
            }
          ]
        }
      ]
    },
    {
      description: 'should generate correct route for snake_case file',
      files: [
          `${pagesDir}/snake_case.vue`
      ],
      output: [
        {
          name: 'snake_case',
          path: '/snake_case',
          file: `${pagesDir}/snake_case.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct route for kebab-case file',
      files: [`${pagesDir}/kebab-case.vue`],
      output: [
        {
          name: 'kebab-case',
          path: '/kebab-case',
          file: `${pagesDir}/kebab-case.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct dynamic routes',
      files: [
          `${pagesDir}/[slug].vue`,
          `${pagesDir}/sub/[slug].vue`,
          `${pagesDir}/[sub]/route-[slug].vue`
      ],
      output: [
        {
          name: 'slug',
          path: '/:slug?',
          file: `${pagesDir}/[slug].vue`,
          children: []
        },
        {
          name: 'sub-slug',
          path: '/sub/:slug?',
          file: `${pagesDir}/sub/[slug].vue`,
          children: []
        },
        {
          name: 'sub-route-slug',
          path: '/:sub/route-:slug',
          file: `${pagesDir}/[sub]/route-[slug].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct catch-all route',
      files: [`${pagesDir}/[...slug].vue`],
      output: [
        {
          name: 'slug',
          path: '/:slug(.*)*',
          file: `${pagesDir}/[...slug].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should throw unfinished param error for dynamic route',
      files: [`${pagesDir}/[slug.vue`],
      error: 'Unfinished param "slug"'
    },
    {
      description: 'should throw empty param error for dynamic route',
      files: [
          `${pagesDir}/[].vue`
      ],
      error: 'Empty param'
    },
    {
      description: 'should only allow "_" & "." as special character for dynamic route',
      files: [
          `${pagesDir}/[a1_1a].vue`,
          `${pagesDir}/[b2.2b].vue`,
          `${pagesDir}/[c3@3c].vue`,
          `${pagesDir}/[d4-4d].vue`
      ],
      output: [
        {
          name: 'a1_1a',
          path: '/:a1_1a?',
          file: `${pagesDir}/[a1_1a].vue`,
          children: []
        },
        {
          name: 'b2.2b',
          path: '/:b2.2b?',
          file: `${pagesDir}/[b2.2b].vue`,
          children: []
        },
        {
          name: 'c33c',
          path: '/:c33c?',
          file: `${pagesDir}/[c3@3c].vue`,
          children: []
        },
        {
          name: 'd44d',
          path: '/:d44d?',
          file: `${pagesDir}/[d4-4d].vue`,
          children: []
        }
      ]
    }
  ]

  for (const test of tests) {
    it(test.description, async () => {
      if (test.error) {
        expect(() => generateRoutesFromFiles(test.files, pagesDir)).to.throws(test.error)
      } else {
        expect(await generateRoutesFromFiles(test.files, pagesDir)).to.deep.equal(test.output)
      }
    })
  }
})
