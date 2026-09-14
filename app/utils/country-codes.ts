export type CountryCode = {
	flag: string
	name: string
	value: string
}

/**
 * Option values double as the dial code that gets prefixed to the number, so
 * every entry needs a distinct value (Canada shares +1 with the US and is
 * covered by that option).
 */
export const countryCodes: ReadonlyArray<CountryCode> = [
	{ flag: '🇺🇸', name: 'United States', value: '+1' },
	{ flag: '🇬🇧', name: 'United Kingdom', value: '+44' },
	{ flag: '🇨🇿', name: 'Czech Republic', value: '+420' },
	{ flag: '🇦🇺', name: 'Australia', value: '+61' },
]

export const defaultCountryCode = countryCodes[0]!.value

export function countryCodeLabel(code: CountryCode) {
	return `${code.flag} ${code.name} ${code.value}`
}
