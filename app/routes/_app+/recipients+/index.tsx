import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { type MetaFunction } from '@remix-run/react'
import { type loader as rootLoader } from '#app/root.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export default function RecipientsIndexRoute() {
	return (
		<div className="container pt-12">
			<p className="text-body-md">Select a recipient</p>
		</div>
	)
}

export const meta: MetaFunction<null, { root: typeof rootLoader }> = ({
	matches,
}) => {
	const rootMatch = matches.find((m) => m.id === 'root')
	const displayName = rootMatch?.data?.user?.name ?? 'Unkown User'
	return [
		{ title: `${displayName}'s Recipients | GratiText` },
		{
			name: 'description',
			content: `${displayName}'s recipients on GratiText`,
		},
	]
}
