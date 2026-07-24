import { prisma } from '#app/utils/db.server.ts'

export const PAST_MESSAGES_PER_PAGE = 30

function parseDateValue(value: string) {
	if (!value) return null
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) return null
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	if (!year || !month || !day) return null
	return { year, month, day }
}

function getDateInTimeZone(
	year: number,
	month: number,
	day: number,
	timeZone: string,
) {
	const utcDate = new Date(Date.UTC(year, month - 1, day))
	const offset = getTimeZoneOffset(utcDate, timeZone)
	return new Date(utcDate.getTime() - offset)
}

function getTimeZoneOffset(date: Date, timeZone: string) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	})
	const parts = formatter.formatToParts(date)
	const values = Object.fromEntries(
		parts.map(({ type, value }) => [type, value]),
	)
	const asUTC = Date.UTC(
		Number(values.year),
		Number(values.month) - 1,
		Number(values.day),
		Number(values.hour),
		Number(values.minute),
		Number(values.second),
	)
	return asUTC - date.getTime()
}

function getStartDate(value: string, timeZone: string) {
	const parts = parseDateValue(value)
	if (!parts) return null
	try {
		const start = getDateInTimeZone(
			parts.year,
			parts.month,
			parts.day,
			timeZone,
		)
		return Number.isNaN(start.getTime()) ? null : start
	} catch {
		return null
	}
}

function getEndDate(value: string, timeZone: string) {
	const parts = parseDateValue(value)
	if (!parts) return null
	try {
		const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1))
		const end = getDateInTimeZone(
			nextDay.getUTCFullYear(),
			nextDay.getUTCMonth() + 1,
			nextDay.getUTCDate(),
			timeZone,
		)
		return Number.isNaN(end.getTime()) ? null : end
	} catch {
		return null
	}
}

export async function getPastMessagesPage({
	recipientId,
	searchQuery,
	startDateFilter,
	endDateFilter,
	cursor,
	filterTimeZone,
}: {
	recipientId: string
	searchQuery: string
	startDateFilter: string
	endDateFilter: string
	cursor?: string | null
	filterTimeZone: string
}) {
	const startDate = getStartDate(startDateFilter, filterTimeZone)
	const endDate = getEndDate(endDateFilter, filterTimeZone)
	const sentAtFilter =
		startDate || endDate
			? {
					...(startDate ? { gte: startDate } : {}),
					...(endDate ? { lt: endDate } : {}),
				}
			: { not: null }
	const pastMessageWhere = {
		recipientId,
		sentAt: sentAtFilter,
		...(searchQuery ? { content: { contains: searchQuery } } : {}),
	}
	const pastMessages = await prisma.message.findMany({
		where: pastMessageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		take: PAST_MESSAGES_PER_PAGE + 1,
	})
	const hasMorePast = pastMessages.length > PAST_MESSAGES_PER_PAGE
	const pastPageMessages = hasMorePast
		? pastMessages.slice(0, PAST_MESSAGES_PER_PAGE)
		: pastMessages
	const nextCursor = hasMorePast
		? pastPageMessages[pastPageMessages.length - 1]?.id
		: null

	return {
		pastMessages: pastPageMessages.map((message) => ({
			id: message.id,
			sentAtDisplay: message.sentAt!.toLocaleDateString('en-US', {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: 'numeric',
			}),
			sentAtIso: message.sentAt!.toISOString(),
			content: message.content,
		})),
		nextCursor,
	}
}
