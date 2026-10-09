import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      '.specify',
      'specs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Canvas 2D 上下文只能通过赋值属性来设置绘制状态
      'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['ctx'] }],
      'no-console': 'error',
    },
  },
  {
    // katex 只是测试里验证 LaTeX 语法的工具, 不得进入运行时 (specs/004 research R8)
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'katex', message: 'katex 只能在测试中使用, 不能进入运行时代码' }] },
      ],
    },
  },
  {
    files: ['*.config.{ts,js}', 'scripts/**'],
    languageOptions: { globals: { ...globals.node } },
  },
)
