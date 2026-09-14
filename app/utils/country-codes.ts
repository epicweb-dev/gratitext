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

/** Select value for numbers whose dial code is not in the list. */
export const OTHER_COUNTRY_CODE = 'other'

/** Joins the country-code select with the national number the user typed. */
export function combinePhoneNumber(countryCode: string, phoneNumber: string) {
	const trimmed = phoneNumber.replace(/[\s().-]/g, '')
	// A number typed with its own "+" prefix is already international.
	if (countryCode === OTHER_COUNTRY_CODE || trimmed.startsWith('+')) {
		return trimmed
	}
	return `${countryCode}${trimmed}`
}

/** Splits a stored E.164 number back into a select value and national part. */
export function splitPhoneNumber(phoneNumber: string) {
	const match = [...countryCodes]
		.sort((a, b) => b.value.length - a.value.length)
		.find((code) => phoneNumber.startsWith(code.value))
	if (!match) return { countryCode: OTHER_COUNTRY_CODE, national: phoneNumber }
	return {
		countryCode: match.value,
		national: phoneNumber.slice(match.value.length),
	}
}
