import { default as defaultConfig } from '@epic-web/config/eslint'

/** @type {import("eslint").Linter.Config} */
export default [
	{
		ignores: ['app/utils/prisma-generated.server/**'],
	},
	...defaultConfig,
	// add custom config objects here:
	{
		files: ['**/tests/e2e/**'],
		rules: {
			// It treats any `.count()` as a Locator, so `--fix` rewrites Prisma
			// counts like `expect(await prisma.message.count({ where })).toBe(0)`
			// into an invalid `expect(prisma.message).toHaveCount(0)`.
			'playwright/prefer-to-have-count': 'off',
		},
	},
]
