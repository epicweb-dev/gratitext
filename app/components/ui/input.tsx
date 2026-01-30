import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					'border-input bg-card text-foreground placeholder:text-muted-secondary-foreground focus-visible:border-ring focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid aria-[invalid]:text-foreground-destructive aria-[invalid]:focus-visible:ring-foreground-destructive flex h-12 w-full rounded-full border px-4 text-sm font-medium shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed',
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Input.displayName = 'Input'

export { Input }
