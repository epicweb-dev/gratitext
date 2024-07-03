import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { requireUserId } from '#app/utils/auth.server.ts'
import { RecipientEditor } from './__editor.tsx'

export { action } from './__editor.server.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	const supportedTimeZones = Intl.supportedValuesOf('timeZone')
	return json({ supportedTimeZones })
}

export const meta: MetaFunction = () => {
	return [{ title: `Create New Recipient | GratiText` }]
}

export default function NewRecipientEditor() {
	const data = useLoaderData<typeof loader>()

	return <RecipientEditor supportedTimeZones={data.supportedTimeZones} />
}
