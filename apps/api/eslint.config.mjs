// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    files: ['test/integration/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['src/modules/kitchen/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            '../orders/order-billing.service',
            '../orders/order-creation.service',
            '../orders/order-lines.service',
            '../orders/order-lifecycle.service',
            '../orders/order-prep.service',
            '../orders/order-read.service',
            '../orders/order-repository',
            '../orders/order-stock.service',
            '../orders/order-table.service',
            '../orders/order-state',
            '../orders/order-pricing',
            '../orders/order-modifiers',
          ].map((name) => ({
            name,
            message:
              'Kitchen must depend on orders only via ../orders/orders.facade (or ../orders/orders.module for Nest wiring).',
          })),
        },
      ],
    },
  },
);
