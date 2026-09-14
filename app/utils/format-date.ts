function ordinalSuffix(day: number) {
	const mod100 = day % 100
	if (mod100 >= 11 && mod100 <= 13) return 'th'
	switch (day % 10) {
		case 1:
			return 'st'
		case 2:
			return 'nd'
		case 3:
			return 'rd'
		default:
			return 'th'
	}
}

/**
 * "Thu June 20th 2024" — the date style used on message bubbles.
 */
export function formatThreadDate(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone,
	}).formatToParts(date)
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? ''
	const day = Number(get('day'))
	return `${get('weekday')} ${get('month')} ${day}${ordinalSuffix(day)} ${get('year')}`
}

/**
 * "10:00 AM GMT+2" — used as the tooltip on message bubbles so the exact
 * send time is still discoverable.
 */
export function formatThreadTime(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone,
		timeZoneName: 'short',
	}).format(date)
}
