import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { Link, type LinkProps } from 'react-router'

import { cn } from '#app/utils/misc.tsx'

const buttonVariants = cva(
	'focus-visible:ring-ring focus-visible:ring-offset-background inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none',
	{
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/60',
				brand:
					'bg-brand text-brand-foreground hover:bg-brand/90 disabled:bg-brand-soft disabled:text-brand-soft-foreground',
				warm: 'bg-warm text-warm-foreground hover:bg-warm/90 disabled:opacity-60',
				warning:
					'bg-warning text-warning-foreground hover:bg-warning/90 disabled:opacity-60',
				destructive:
					'bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60',
				secondary:
					'border-input bg-secondary text-secondary-foreground hover:bg-muted/60 border disabled:opacity-60',
				outline:
					'border-input bg-secondary text-secondary-foreground hover:bg-muted/60 border disabled:opacity-60',
				inverse:
					'bg-inverse text-warning hover:bg-inverse/90 dark:text-warning disabled:opacity-60',
				ghost: 'text-foreground hover:bg-muted/60 disabled:opacity-60',
				'ghost-inverse': 'text-inverse hover:bg-inverse/15 disabled:opacity-60',
				link: 'text-foreground underline-offset-4 hover:underline disabled:opacity-60',
			},
			size: {
				default: 'h-12 px-6 text-sm',
				lg: 'h-14 px-8 text-base',
				wide: 'h-14 px-14 text-base',
				sm: 'h-10 px-4 text-xs',
				xs: 'h-8 px-3 text-[0.6875rem]',
				pill: 'h-10 px-6 text-xs',
				icon: 'h-10 w-10 p-0',
				'icon-lg': 'h-12 w-12 p-0',
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
	extends
		React.ButtonHTMLAttributes<HTMLButtonElement>,
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
		<Link
			className={buttonVariants({ variant, size, icon, className })}
			{...props}
		/>
	)
}

export { Button, buttonVariants }
