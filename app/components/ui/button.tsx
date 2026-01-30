import { Slot } from '@radix-ui/react-slot'
import { Link, type LinkProps } from '@remix-run/react'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
				destructive:
					'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
				outline:
					'border border-border bg-card text-foreground hover:bg-muted',
				secondary:
					'border border-border bg-transparent text-foreground hover:bg-muted',
				ghost: 'text-foreground hover:bg-muted',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-12 px-6',
				wide: 'h-12 px-14',
				sm: 'h-10 px-4 text-xs',
				lg: 'h-14 px-8 text-base',
				pill: 'h-10 px-8 text-sm',
				icon: 'h-10 w-10 p-0',
			},
			icon: {
				true: 'h-10 w-10 rounded-full p-2',
				false: '',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		)
	},
)
Button.displayName = 'Button'

export function ButtonLink({
	variant,
	size,
	icon,
	className,
	...props
}: LinkProps & VariantProps<typeof buttonVariants>) {
	return (
		<Link className={buttonVariants({ variant, size, icon, className })} {...props} />
	)
}

export { Button, buttonVariants }
