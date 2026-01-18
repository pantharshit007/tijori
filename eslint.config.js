//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    ignores: [
      '.agent',
      '.opencode',
      'convex/_generated/**',
      'init.md',
      'progress-log/**',
      'learning.md',
      'eslint.config.js',
      'prettier.config.js',
      '.output',
      '.tanstack',
      'src/components/ui/**',
    ],
  },
]
