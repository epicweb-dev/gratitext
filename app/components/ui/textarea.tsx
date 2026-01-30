import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'border-input bg-card text-foreground placeholder:text-muted-secondary-foreground focus-visible:border-ring focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid aria-[invalid]:text-foreground-destructive aria-[invalid]:focus-visible:ring-foreground-destructive flex min-h-[120px] w-full rounded-3xl border px-4 py-3 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed',
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
