const angular = require('@angular-eslint/eslint-plugin');
const angularTemplate = require('@angular-eslint/eslint-plugin-template');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser, parserOptions: { project: ['./tsconfig.json'] } },
    plugins: { '@angular-eslint': angular },
    rules: {
      '@angular-eslint/component-class-suffix': ['error', { suffixes: ['Component', 'Page'] }],
      '@angular-eslint/directive-class-suffix': 'error'
    }
  },
  {
    files: ['src/**/*.html'],
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {}
  }
];
