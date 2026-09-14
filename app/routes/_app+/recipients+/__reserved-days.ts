import { parseWeeklyCron } from '#app/utils/weekly-schedule.ts'
import { type ReservedDays } from './__editor.tsx'
import { type RecipientsOutletContext } from './_layout.tsx'

/**
 * On the Basic plan only one message goes out per day, so a weekday another
 * active recipient already uses is off limits in the day picker.
 */
export function getReservedDays({
	recipients,
	subscriptionStatus,
	excludeRecipientId,
}: RecipientsOutletContext & { excludeRecipientId?: string }): ReservedDays {
	if (subscriptionStatus !== 'basic') return {}
	const reserved: ReservedDays = {}
	for (const recipient of recipients) {
		if (recipient.id === excludeRecipientId || recipient.disabled) continue
		const weekly = parseWeeklyCron(recipient.scheduleCron)
		if (weekly && !reserved[weekly.day]) reserved[weekly.day] = recipient.name
	}
	return reserved
}
