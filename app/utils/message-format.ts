type MessageInput = {
	id: string
	content: string
	sentAt: Date
}

export function formatMessage(message: MessageInput) {
	return {
		id: message.id,
		content: message.content,
		sentAtIso: message.sentAt.toISOString(),
		sentAtDisplay: message.sentAt.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
		}),
	}
}
