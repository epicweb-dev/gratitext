import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const inputClassName =
	'border-input bg-field text-field-foreground placeholder:text-subtle-foreground focus-visible:border-ring disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid flex h-14 w-full rounded-full border px-5 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-semibold focus-visible:outline-none disabled:cursor-not-allowed disabled:border-transparent'

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(inputClassName, className)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Input.displayName = 'Input'

export { Input }
