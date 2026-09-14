export const weekdays = [
	{ value: '0', label: 'Sunday', short: 'Sun' },
	{ value: '1', label: 'Monday', short: 'Mon' },
	{ value: '2', label: 'Tuesday', short: 'Tue' },
	{ value: '3', label: 'Wednesday', short: 'Wed' },
	{ value: '4', label: 'Thursday', short: 'Thu' },
	{ value: '5', label: 'Friday', short: 'Fri' },
	{ value: '6', label: 'Saturday', short: 'Sat' },
] as const

export type WeekdayValue = (typeof weekdays)[number]['value']

function formatTime(hour: number, minute: number) {
	const period = hour < 12 ? 'AM' : 'PM'
	const displayHour = hour % 12 === 0 ? 12 : hour % 12
	return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}

/** Quarter-hour slots from 12:00 AM to 11:45 PM, valued "HH:MM". */
export const timeOptions = Array.from({ length: 24 * 4 }, (_, index) => {
	const hour = Math.floor(index / 4)
	const minute = (index % 4) * 15
	return {
		value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
		label: formatTime(hour, minute),
	}
})

export type WeeklySchedule = { day: WeekdayValue; time: string }

/** Recognises the "minute hour * * weekday" crons the day/time pickers emit. */
export function parseWeeklyCron(cron: string): WeeklySchedule | null {
	const match = /^\s*(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+([0-6])\s*$/.exec(cron)
	if (!match) return null
	const minute = Number(match[1])
	const hour = Number(match[2])
	if (minute > 59 || hour > 23) return null
	const day = match[3] as WeekdayValue
	const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
	return { day, time }
}

export function buildWeeklyCron({ day, time }: WeeklySchedule) {
	const [hour, minute] = time.split(':').map(Number)
	return `${minute ?? 0} ${hour ?? 0} * * ${day}`
}

export function isWeeklyTimeOption(time: string) {
	return timeOptions.some((option) => option.value === time)
}
