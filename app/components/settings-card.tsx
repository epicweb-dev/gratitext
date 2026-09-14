import { type ReactNode } from 'react'
import { SettingsOverview } from '#app/routes/_app+/settings.profile+/__overview.tsx'
import { DialogPage } from './dialog-page.tsx'

/**
 * Account settings sub-pages: a dialog floating over the (inert) settings
 * overview on desktop, and a plain page with a back link on phones.
 */
export function SettingsCard({
	title,
	description,
	children,
	backTo = '/settings/profile',
	backLabel,
	hideClose,
	className,
}: {
	title: string
	description?: ReactNode
	children: ReactNode
	backTo?: string
	backLabel?: string
	hideClose?: boolean
	className?: string
}) {
	return (
		<>
			<SettingsOverview inert className="hidden md:flex" />
			<DialogPage
				title={title}
				description={description}
				backTo={backTo}
				backLabel={backLabel}
				hideClose={hideClose}
				className={className}
			>
				{children}
			</DialogPage>
		</>
	)
}
