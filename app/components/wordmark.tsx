import { Link } from 'react-router'
import { cn } from '#app/utils/misc.tsx'

export function Wordmark({
	className,
	onClick,
}: {
	className?: string
	onClick?: () => void
}) {
	return (
		<Link
			to="/"
			onClick={onClick}
			aria-label="GratiText home"
			className={cn(
				'font-display text-foreground inline-block text-[1.375rem] leading-none lowercase',
				className,
			)}
		>
			gratitext
		</Link>
	)
}
