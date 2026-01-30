import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

export interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'flex min-h-[120px] w-full rounded-3xl border border-input bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors placeholder:text-muted-secondary-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid aria-[invalid]:text-foreground-destructive aria-[invalid]:focus-visible:ring-foreground-destructive',
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Textarea.displayName = 'Textarea'

export { Textarea }
