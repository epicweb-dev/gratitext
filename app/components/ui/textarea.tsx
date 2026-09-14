import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'border-input bg-field text-field-foreground placeholder:text-subtle-foreground focus-visible:border-ring disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid flex min-h-[120px] w-full rounded-3xl border px-5 py-4 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed',
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
