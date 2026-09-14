import { type ReactNode, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFocusTrap } from '#app/utils/focus-trap.ts'
import { cn } from '#app/utils/misc.tsx'
import { Icon } from './ui/icon.tsx'

/**
 * A route rendered as a modal dialog over its parent page on desktop and as a
 * plain full-width page (with a "go back" link) on phones — the pattern the
 * account settings sub-pages use in the designs.
 */
export function DialogPage({
	title,
	description,
	backTo,
	backLabel = 'Go back without changes',
	hideClose = false,
	children,
	className,
}: {
	title: string
	description?: ReactNode
	backTo: string
	backLabel?: string
	/** Skip the corner close button when the content has its own Cancel. */
	hideClose?: boolean
	children: ReactNode
	className?: string
}) {
	const navigate = useNavigate()
	const panelRef = useRef<HTMLDivElement>(null)
	const close = useCallback(() => {
		void navigate(backTo)
	}, [navigate, backTo])
	// Only trap focus when the dialog is actually floating (md and up).
	const isDesktop =
		typeof window !== 'undefined' &&
		window.matchMedia('(min-width: 768px)').matches
	useFocusTrap(panelRef, isDesktop, close)

	return (
		<div className="flex flex-1 flex-col md:fixed md:inset-0 md:z-50 md:flex-none md:items-center md:justify-center md:p-6">
			<Link
				to={backTo}
				tabIndex={-1}
				aria-hidden="true"
				className="bg-overlay/70 absolute inset-0 hidden backdrop-blur-[4px] md:block"
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="dialog-page-title"
				tabIndex={-1}
				className={cn(
					'md:bg-card md:text-card-foreground container flex flex-1 flex-col pt-6 pb-6 outline-none md:relative md:max-h-full md:w-full md:max-w-[46.5rem] md:flex-none md:overflow-y-auto md:rounded-[1.75rem] md:px-12 md:py-11 md:shadow-[0_32px_64px_-24px_rgba(24,36,48,0.35)]',
					className,
				)}
			>
				<Link
					to={backTo}
					className="text-foreground hover:text-brand -ml-1 inline-flex w-fit items-center gap-2 text-base transition-colors md:hidden"
				>
					<Icon name="chevron-left" size="sm" aria-hidden="true" />
					{backLabel}
				</Link>
				{hideClose ? null : (
					<Link
						to={backTo}
						aria-label="Close"
						className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-6 right-6 hidden h-10 w-10 items-center justify-center rounded-full transition-colors md:flex"
					>
						<Icon name="cross-1" size="sm" aria-hidden="true" />
					</Link>
				)}
				<h1
					id="dialog-page-title"
					className="font-display text-foreground md:text-h3 sr-only md:not-sr-only"
				>
					{title}
				</h1>
				{description ? (
					<p className="text-muted-foreground hidden text-base md:mt-4 md:block">
						{description}
					</p>
				) : null}
				<div className="mt-6 flex flex-1 flex-col md:mt-8 md:flex-none">
					{children}
				</div>
			</div>
		</div>
	)
}
