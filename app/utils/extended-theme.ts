/**
 * Mirror of the design tokens declared in `app/styles/tailwind.css`. Tailwind
 * v4 reads the CSS directly; this object only teaches `tailwind-merge` (see
 * `cn()`) which class names are colours, radii and text styles so conflicting
 * utilities dedupe correctly.
 */
export const extendedTheme = {
	colors: {
		border: 'hsl(var(--border))',
		input: {
			DEFAULT: 'hsl(var(--input))',
			invalid: 'hsl(var(--input-invalid))',
		},
		ring: {
			DEFAULT: 'hsl(var(--ring))',
			invalid: 'hsl(var(--foreground-destructive))',
		},
		background: 'hsl(var(--background))',
		foreground: {
			DEFAULT: 'hsl(var(--foreground))',
			destructive: 'hsl(var(--foreground-destructive))',
		},
		surface: {
			DEFAULT: 'hsl(var(--surface))',
			foreground: 'hsl(var(--surface-foreground))',
			border: 'hsl(var(--surface-border))',
		},
		field: {
			DEFAULT: 'hsl(var(--field))',
			foreground: 'hsl(var(--field-foreground))',
		},
		primary: {
			DEFAULT: 'hsl(var(--primary))',
			foreground: 'hsl(var(--primary-foreground))',
		},
		secondary: {
			DEFAULT: 'hsl(var(--secondary))',
			foreground: 'hsl(var(--secondary-foreground))',
		},
		destructive: {
			DEFAULT: 'hsl(var(--destructive))',
			foreground: 'hsl(var(--destructive-foreground))',
		},
		muted: {
			DEFAULT: 'hsl(var(--muted))',
			foreground: 'hsl(var(--muted-foreground))',
		},
		'subtle-foreground': 'hsl(var(--subtle-foreground))',
		accent: {
			DEFAULT: 'hsl(var(--accent))',
			foreground: 'hsl(var(--accent-foreground))',
		},
		popover: {
			DEFAULT: 'hsl(var(--popover))',
			foreground: 'hsl(var(--popover-foreground))',
		},
		card: {
			DEFAULT: 'hsl(var(--card))',
			foreground: 'hsl(var(--card-foreground))',
		},
		overlay: 'hsl(var(--overlay))',
		inverse: 'hsl(var(--inverse))',
		brand: {
			DEFAULT: 'hsl(var(--brand))',
			foreground: 'hsl(var(--brand-foreground))',
		},
		'brand-soft': {
			DEFAULT: 'hsl(var(--brand-soft))',
			foreground: 'hsl(var(--brand-soft-foreground))',
		},
		'brand-muted': {
			DEFAULT: 'hsl(var(--brand-muted))',
			foreground: 'hsl(var(--brand-muted-foreground))',
		},
		warm: {
			DEFAULT: 'hsl(var(--warm))',
			foreground: 'hsl(var(--warm-foreground))',
		},
		warning: {
			DEFAULT: 'hsl(var(--warning))',
			foreground: 'hsl(var(--warning-foreground))',
		},
		sent: {
			DEFAULT: 'hsl(var(--sent))',
			foreground: 'hsl(var(--sent-foreground))',
		},
		scheduled: {
			DEFAULT: 'hsl(var(--scheduled))',
			foreground: 'hsl(var(--scheduled-foreground))',
		},
		hero: 'hsl(var(--hero))',
		feature: {
			DEFAULT: 'hsl(var(--feature))',
			foreground: 'hsl(var(--feature-foreground))',
		},
		pricing: 'hsl(var(--pricing))',
		cta: {
			DEFAULT: 'hsl(var(--cta))',
			foreground: 'hsl(var(--cta-foreground))',
		},
		palette: {
			sunny: 'hsl(var(--palette-sunny))',
			orange: 'hsl(var(--palette-orange))',
			'fire-red': 'hsl(var(--palette-fire-red))',
			'rose-pink': 'hsl(var(--palette-rose-pink))',
			'dust-pink': 'hsl(var(--palette-dust-pink))',
			lilac: 'hsl(var(--palette-lilac))',
			'baby-blue': 'hsl(var(--palette-baby-blue))',
			blues: 'hsl(var(--palette-blues))',
			'green-500': 'hsl(var(--palette-green-500))',
			chestnut: 'hsl(var(--palette-chestnut))',
			beige: 'hsl(var(--palette-beige))',
			cream: 'hsl(var(--palette-cream))',
			navy: 'hsl(var(--palette-navy))',
			'dark-navy': 'hsl(var(--palette-dark-navy))',
		},
	},
	borderRadius: {
		sm: 'calc(var(--radius) - 12px)',
		md: 'calc(var(--radius) - 8px)',
		lg: 'calc(var(--radius) - 4px)',
		xl: 'var(--radius)',
		'2xl': 'calc(var(--radius) + 4px)',
		'3xl': 'calc(var(--radius) + 12px)',
	},
	fontSize: {
		h1: ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
		h2: ['2.5rem', { lineHeight: '1.15', fontWeight: '700' }],
		h3: ['2rem', { lineHeight: '1.2', fontWeight: '700' }],
		h4: ['1.5rem', { lineHeight: '1.25', fontWeight: '700' }],
		h5: ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
		h6: ['1.125rem', { lineHeight: '1.3', fontWeight: '700' }],
		'body-lg': ['1.125rem', { lineHeight: '1.6' }],
		'body-md': ['1rem', { lineHeight: '1.6' }],
		'body-sm': ['0.875rem', { lineHeight: '1.5' }],
		'body-xs': ['0.8125rem', { lineHeight: '1.4' }],
		'body-2xs': ['0.75rem', { lineHeight: '1.35' }],
		label: ['0.75rem', { lineHeight: '1rem', fontWeight: '600' }],
	},
} as const
