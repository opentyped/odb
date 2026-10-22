import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'tests/.output/**',
      'tests/.golden-*/**',
      'examples/**/generated/**',
      'tests/**/models.d.ts',
      'tests/**/kysely.d.ts',
      'tests/**/kanel/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ['tests/*/usage.ts', 'tests/*/runtime.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off', 'no-constant-condition': 'off' },
  },
  {
    files: ['packages/**/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use package-local ~/ imports; the build resolves emitted .js extensions.',
            },
          ],
        },
      ],
    },
  },
  prettier,
  {
    files: ['packages/**/src/**/*.ts'],
    rules: { curly: ['error', 'all'] },
  },
  {
    files: ['packages/db/src/**/*.ts'],
    rules: {
      'no-else-return': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['if', 'for', 'return', 'switch', 'try'] },
      ],
    },
  },
);
