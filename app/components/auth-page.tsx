import { type ReactNode } from 'react'
import { cn } from '#app/utils/misc.tsx'

/**
 * Auth routes export this handle so the app layout tints the header to match
 * the full-bleed beige auth page on small screens and drops the sign-up /
 * log-in buttons that would compete with the form.
 */
export const authPageHandle = { pageTint: 'hero', chrome: 'minimal' } as const

export function AuthPage({
	title,
	description,
	children,
	footer,
}: {
	title: string
	description?: ReactNode
	children: ReactNode
	footer?: ReactNode
}) {
	return (
		<main className="bg-hero md:bg-background flex flex-1 flex-col pt-10 pb-6 md:pt-20 md:pb-24">
			<div className="container flex flex-1 flex-col md:max-w-[52rem] md:flex-none">
				<div className="text-center">
					<h1 className="font-display text-foreground text-[1.875rem] leading-[1.15] text-balance md:text-h2">
						{title}
					</h1>
					{description ? (
						<p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-pretty md:mt-5">
							{description}
						</p>
					) : null}
				</div>
				<div className="md:bg-surface md:text-surface-foreground mt-10 flex flex-1 flex-col md:mt-14 md:flex-none md:rounded-[1.5rem] md:px-9 md:py-9 lg:px-9">
					{children}
				</div>
				{footer ? (
					<div className="text-muted-foreground [&_a]:text-foreground mt-6 text-center text-sm [&_a]:inline-flex [&_a]:items-center [&_a]:gap-2 [&_a]:font-medium [&_a]:underline-offset-4 hover:[&_a]:underline md:mt-8">
						{footer}
					</div>
				) : null}
			</div>
		</main>
	)
}

/**
 * Bottom row of an auth form: optional helper text on the left and the
 * primary action on the right. On phones the action becomes a full-width
 * button anchored to the bottom of the screen, as in the mobile designs.
 */
export function AuthActions({
	aside,
	children,
	className,
}: {
	aside?: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				'mt-auto flex flex-col gap-5 pt-6 md:mt-0 md:flex-row md:items-center md:justify-between md:gap-6 md:pt-2',
				className,
			)}
		>
			<div className="text-foreground [&_a]:text-foreground text-sm [&_a]:underline-offset-4 hover:[&_a]:underline">
				{aside}
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-center [&>*]:w-full md:[&>*]:w-auto">
				{children}
			</div>
		</div>
	)
}
