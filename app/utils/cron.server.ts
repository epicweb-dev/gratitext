/*
 * This entire file should be swapped for something more official.
 * Probably inngest... But we're gonna stick with this for now and see how far
 * it gets us.
 */
import { CronExpressionParser } from 'cron-parser'

export class CronParseError extends Error {
	constructor(
		message: string,
		public readonly cronString: string,
	) {
		super(message)
		this.name = 'CronParseError'
	}
}

function parseCronExpression(
	cronString: string,
	options?: { tz?: string; currentDate?: Date },
) {
	try {
		return CronExpressionParser.parse(cronString, options)
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Invalid cron string'
		throw new CronParseError(errorMessage, cronString)
	}
}

export function getScheduleWindow(
	scheduleCron: string,
	timeZone: string,
	currentDate: Date = new Date(),
) {
	const interval = parseCronExpression(scheduleCron, {
		tz: timeZone,
		currentDate,
	})
	const prevScheduledAt = interval.prev().toDate()
	const nextScheduledAt = interval.next().toDate()
	return { prevScheduledAt, nextScheduledAt }
}

export function getSendTime(
	scheduleCron: string,
	options: { tz: string },
	number: number,
) {
	const interval = parseCronExpression(scheduleCron, options)
	let next = interval.next().toDate()
	while (number-- > 0) next = interval.next().toDate()
	return next
}

export function getNextScheduledTime(scheduleCron: string, timeZone: string) {
	const interval = parseCronExpression(scheduleCron, { tz: timeZone })
	return interval.next().toDate()
}

export function formatSendTime(date: Date, timezone: string): string {
	const options: Intl.DateTimeFormatOptions = {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true,
		timeZone: timezone,
		timeZoneName: 'short',
	}

	return new Intl.DateTimeFormat('en-US', options).format(date)
}
