import { useForm, getFormProps } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { invariantResponse } from '@epic-web/invariant'
import {
	data as json,
	redirect,
	type ActionFunctionArgs,
	useFetcher,
	useFetchers,
} from 'react-router'
import { z } from 'zod'
import { Icon } from '#app/components/ui/icon.tsx'
import { useHints } from '#app/utils/client-hints.tsx'
import { useRequestInfo } from '#app/utils/request-info.ts'
import { type Theme, setTheme } from '#app/utils/theme.server.ts'

const ThemeFormSchema = z.object({
	theme: z.enum(['system', 'light', 'dark']),
})

// Action-only resource route: a bare GET (bookmark, bot, refresh) has no
// loader otherwise and becomes a React Router RouteErrorResponse.
export function loader() {
	return redirect('/')
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: ThemeFormSchema,
	})

	invariantResponse(submission.status === 'success', 'Invalid theme received')

	const { theme } = submission.value

	const responseInit = {
		headers: { 'set-cookie': setTheme(theme) },
	}
	return json({ result: submission.reply() }, responseInit)
}

export function ThemeSwitch({
	userPreference,
}: {
	userPreference?: Theme | null
}) {
	const fetcher = useFetcher<typeof action>()

	const [form] = useForm({
		id: 'theme-switch',
		lastResult: fetcher.data?.result,
	})

	const optimisticMode = useOptimisticThemeMode()
	const mode = optimisticMode ?? userPreference ?? 'system'
	const nextMode =
		mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'
	const modeMeta = {
		light: { icon: 'sun', label: 'Light' },
		dark: { icon: 'moon', label: 'Dark' },
		system: { icon: 'laptop', label: 'System' },
	} as const
	const current = modeMeta[mode]
	const next = modeMeta[nextMode]
	const description = `Theme: ${current.label}. Switch to ${next.label.toLowerCase()} theme`

	return (
		<fetcher.Form
			method="POST"
			{...getFormProps(form)}
			action="/resources/theme-switch"
		>
			<input type="hidden" name="theme" value={nextMode} />
			<button
				type="submit"
				title={description}
				aria-label={description}
				className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
			>
				<Icon name={current.icon} size="sm" aria-hidden="true" />
			</button>
		</fetcher.Form>
	)
}

/**
 * If the user's changing their theme mode preference, this will return the
 * value it's being changed to.
 */
export function useOptimisticThemeMode() {
	const fetchers = useFetchers()
	const themeFetcher = fetchers.find(
		(f) => f.formAction === '/resources/theme-switch',
	)

	if (themeFetcher && themeFetcher.formData) {
		const submission = parseWithZod(themeFetcher.formData, {
			schema: ThemeFormSchema,
		})

		if (submission.status === 'success') {
			return submission.value.theme
		}
	}
}

/**
 * @returns the user's theme preference, or the client hint theme if the user
 * has not set a preference.
 */
export function useTheme() {
	const hints = useHints()
	const requestInfo = useRequestInfo()
	const optimisticMode = useOptimisticThemeMode()
	if (optimisticMode) {
		return optimisticMode === 'system' ? hints.theme : optimisticMode
	}
	return requestInfo.userPrefs.theme ?? hints.theme
}
