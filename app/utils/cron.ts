import cronParser from 'cron-parser'

export function validateCronString(cronString: string): {
	valid: boolean
	error?: string
} {
	try {
		cronParser.parseExpression(cronString)
		return { valid: true }
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Invalid cron string'
		return {
			valid: false,
			error: errorMessage,
		}
	}
}
