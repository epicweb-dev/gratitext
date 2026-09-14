export type TimeZoneOption = { value: string; label: string; offset: string }

let cachedOptions: Array<TimeZoneOption> | null = null

function getOffset(timeZone: string, date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		timeZoneName: 'shortOffset',
	}).formatToParts(date)
	return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
}

function offsetMinutes(offset: string) {
	const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offset)
	if (!match) return 0
	const sign = match[1] === '-' ? -1 : 1
	return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

/**
 * Every IANA zone the runtime knows about, labelled like the design's
 * "UTC +2 CEST Prague" and ordered west to east.
 */
export function getTimeZoneOptions() {
	if (cachedOptions) return cachedOptions
	const now = new Date()
	cachedOptions = Intl.supportedValuesOf('timeZone')
		.map((value) => {
			const offset = getOffset(value, now)
			const city = value.split('/').pop()?.replaceAll('_', ' ') ?? value
			const region = value.includes('/') ? value.split('/')[0] : null
			return {
				value,
				offset,
				label: `${offset.replace('GMT', 'UTC ')} ${city}${region ? ` (${region.replaceAll('_', ' ')})` : ''}`,
			}
		})
		.sort(
			(a, b) =>
				offsetMinutes(a.offset) - offsetMinutes(b.offset) ||
				a.label.localeCompare(b.label),
		)
	return cachedOptions
}
