import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/api/**']
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true
        }
      ],
      'no-console': [
        'error',
        {
          allow: ['warn', 'error']
        }
      ]
    }
  },
  {
    files: ['src/api/**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'off',
        {
          'ts-expect-error': false
        }
      ]
    }
  }
];

export default eslintConfig;
