/*
=======================================================================================================================================
ESLint configuration - lmslocal-server
=======================================================================================================================================
Flat config (ESLint 9). The server is plain CommonJS Node, so there is no TypeScript plugin
here - the value is catching typos, unreachable code, unused requires and shadowed variables
before they reach production.
=======================================================================================================================================
*/

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      '**/*.delete',        // disabled routes, preserved deliberately
      '*.json',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      /*
      Unused ARGUMENTS are deliberately not reported.

      Express identifies an error-handling middleware by its arity - a function must take
      exactly (err, req, res, next) to be treated as one. server.js has such a handler where
      `next` is genuinely unused. Reporting it would invite someone to "fix" the warning by
      deleting the parameter, which silently turns the error handler into ordinary middleware
      and breaks error handling across the whole API.

      Unused VARIABLES and REQUIRES are still reported - that is where the real value is.
      */
      'no-unused-vars': ['warn', {
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: '^_',
      }],

      // console is the logging mechanism throughout this codebase, not a leftover
      'no-console': 'off',

      // Genuine bug catchers, promoted to errors
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-async-promise-executor': 'error',

      /*
      Off deliberately. It fires on `req.user = ...` after an await, which is the standard
      Express middleware pattern and is safe here - every request gets its own `req` object,
      so there is no shared state to race on. It flagged all three auth middlewares and a
      transaction callback, all false positives. Leaving it on would train us to ignore errors.
      */
      'require-atomic-updates': 'off',
    },
  },
];
