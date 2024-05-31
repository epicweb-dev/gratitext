import { type MetaFunction } from '@remix-run/react'
import { type loader as recipientsLoader } from './recipients.tsx'

export default function RecipientsIndexRoute() {
	return (
		<div className="container pt-12">
			<p className="text-body-md">Select a recipient</p>
		</div>
	)
}

export const meta: MetaFunction<
	null,
	{ 'routes/users+/$username_+/recipients': typeof recipientsLoader }
> = ({ params, matches }) => {
	const recipientsMatch = matches.find(
		m => m.id === 'routes/users+/$username_+/recipients',
	)
	const displayName = recipientsMatch?.data?.owner.name ?? params.username
	const recipientsCount = recipientsMatch?.data?.owner.recipients.length ?? 0
	const recipientsText = recipientsCount === 1 ? 'recipient' : 'recipients'
	return [
		{ title: `${displayName}'s Recipients | GratiText` },
		{
			name: 'description',
			content: `Checkout ${displayName}'s ${recipientsCount} ${recipientsText} on GratiText`,
		},
	]
}
