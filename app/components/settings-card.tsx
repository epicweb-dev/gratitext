import { type ReactNode } from 'react'
import { cn } from '#app/utils/misc.tsx'

export function SettingsCard({
	title,
	description,
	children,
	className,
	headingId = 'settings-card-heading',
}: {
	title: string
	description?: ReactNode
	children: ReactNode
	className?: string
	headingId?: string
}) {
	return (
		<section
			aria-labelledby={headingId}
			className={cn(
				'border-border bg-card rounded-[32px] border p-6 shadow-sm sm:p-8',
				className,
			)}
		>
			<h1 id={headingId} className="text-foreground text-2xl font-bold">
				{title}
			</h1>
			{description ? (
				<div className="text-muted-foreground mt-2 text-sm">{description}</div>
			) : null}
			<div className="mt-6">{children}</div>
		</section>
	)
}
