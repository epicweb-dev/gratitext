import { default as defaultConfig } from '@epic-web/config/eslint'

/** @type {import("eslint").Linter.Config} */
export default [
	{
		ignores: ['app/utils/prisma-generated.server/**'],
	},
	...defaultConfig,
	// add custom config objects here:
]
