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
		'muted-secondary': {
			DEFAULT: 'hsl(var(--muted-secondary))',
			foreground: 'hsl(var(--muted-secondary-foreground))',
		},
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
		warm: {
			DEFAULT: 'hsl(var(--warm))',
			foreground: 'hsl(var(--warm-foreground))',
		},
		warning: {
			DEFAULT: 'hsl(var(--warning))',
			foreground: 'hsl(var(--warning-foreground))',
		},
		'banner-trial': {
			DEFAULT: 'hsl(var(--banner-trial))',
			foreground: 'hsl(var(--banner-trial-foreground))',
		},
		'banner-upgrade': {
			DEFAULT: 'hsl(var(--banner-upgrade))',
			foreground: 'hsl(var(--banner-upgrade-foreground))',
		},
		'price-basic': 'hsl(var(--price-basic))',
		'price-premium': 'hsl(var(--price-premium))',
		'hero-orb': 'hsl(var(--hero-orb))',
		'hero-sparkle': 'hsl(var(--hero-sparkle))',
		'marketing-feature': {
			DEFAULT: 'hsl(var(--marketing-feature))',
			foreground: 'hsl(var(--marketing-feature-foreground))',
			muted: 'hsl(var(--marketing-feature-muted))',
			accent: 'hsl(var(--marketing-feature-accent))',
			'accent-secondary': 'hsl(var(--marketing-feature-accent-secondary))',
		},
		'marketing-step-index': 'hsl(var(--marketing-step-index))',
		'marketing-cta': {
			DEFAULT: 'hsl(var(--marketing-cta))',
			foreground: 'hsl(var(--marketing-cta-foreground))',
			accent: 'hsl(var(--marketing-cta-accent))',
		},
		'message-bubble': {
			DEFAULT: 'hsl(var(--message-bubble))',
			foreground: 'hsl(var(--message-bubble-foreground))',
		},
		'message-card': {
			DEFAULT: 'hsl(var(--message-card))',
			foreground: 'hsl(var(--message-card-foreground))',
		},
	},
	borderRadius: {
		lg: 'var(--radius)',
		md: 'calc(var(--radius) - 2px)',
		sm: 'calc(var(--radius) - 4px)',
	},
	fontSize: {
		// 1rem = 16px
		/** 80px size / 84px high / bold */
		mega: ['5rem', { lineHeight: '5.25rem', fontWeight: '700' }],
		/** 56px size / 62px high / bold */
		h1: ['3.5rem', { lineHeight: '3.875rem', fontWeight: '700' }],
		/** 40px size / 48px high / bold */
		h2: ['2.5rem', { lineHeight: '3rem', fontWeight: '700' }],
		/** 32px size / 36px high / bold */
		h3: ['2rem', { lineHeight: '2.25rem', fontWeight: '700' }],
		/** 28px size / 36px high / bold */
		h4: ['1.75rem', { lineHeight: '2.25rem', fontWeight: '700' }],
		/** 24px size / 32px high / bold */
		h5: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
		/** 16px size / 20px high / bold */
		h6: ['1rem', { lineHeight: '1.25rem', fontWeight: '700' }],

		/** 32px size / 36px high / normal */
		'body-2xl': ['2rem', { lineHeight: '2.25rem' }],
		/** 28px size / 36px high / normal */
		'body-xl': ['1.75rem', { lineHeight: '2.25rem' }],
		/** 24px size / 32px high / normal */
		'body-lg': ['1.5rem', { lineHeight: '2rem' }],
		/** 20px size / 28px high / normal */
		'body-md': ['1.25rem', { lineHeight: '1.75rem' }],
		/** 16px size / 20px high / normal */
		'body-sm': ['1rem', { lineHeight: '1.25rem' }],
		/** 14px size / 18px high / normal */
		'body-xs': ['0.875rem', { lineHeight: '1.125rem' }],
		/** 12px size / 16px high / normal */
		'body-2xs': ['0.75rem', { lineHeight: '1rem' }],

		/** 18px size / 24px high / semibold */
		caption: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
		/** 12px size / 16px high / bold */
		button: ['0.75rem', { lineHeight: '1rem', fontWeight: '700' }],
	},
} as const
