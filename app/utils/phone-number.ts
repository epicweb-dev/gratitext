const stripNonDigits = (value: string) => value.replace(/\D/g, '')

export const formatPhoneNumberWithCountryCode = ({
	countryCode,
	phoneNumber,
}: {
	countryCode: string
	phoneNumber: string
}) => {
	const digitsOnly = stripNonDigits(phoneNumber)
	return `${countryCode}${digitsOnly}`.replace(/\s+/g, '')
}

export const formatPhoneNumberIdentifier = ({
	countryCode,
	phoneNumber,
}: {
	countryCode: string
	phoneNumber: string
}) => {
	const raw = phoneNumber.trim()
	const digitsOnly = stripNonDigits(raw)
	if (raw.startsWith('+')) {
		return `+${digitsOnly}`
	}
	return formatPhoneNumberWithCountryCode({
		countryCode,
		phoneNumber: digitsOnly,
	})
}

export const getPhoneCandidateList = ({
	identifier,
	countryCode,
}: {
	identifier: string
	countryCode?: string
}) => {
	const normalizedIdentifier = identifier.trim()
	const phoneCandidates = new Set<string>()
	if (normalizedIdentifier) {
		phoneCandidates.add(normalizedIdentifier)
		phoneCandidates.add(normalizedIdentifier.replace(/\s+/g, ''))
	}

	const digitsOnly = stripNonDigits(normalizedIdentifier)
	if (digitsOnly) {
		phoneCandidates.add(digitsOnly)
		if (countryCode) {
			phoneCandidates.add(
				formatPhoneNumberWithCountryCode({
					countryCode,
					phoneNumber: digitsOnly,
				}),
			)
		}
		if (normalizedIdentifier.startsWith('+')) {
			phoneCandidates.add(`+${digitsOnly}`)
		}
	}

	return [...phoneCandidates].filter(Boolean)
}
