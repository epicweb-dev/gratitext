import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
	useOutletContext,
} from 'react-router'
import { formPageHandle } from '#app/components/form-page.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getTimeZoneOptions } from '#app/utils/time-zones.server.ts'
import { RecipientEditor } from './__editor.tsx'
import { getReservedDays } from './__reserved-days.ts'
import { type RecipientsOutletContext } from './_layout.tsx'

export { action } from './__editor.server.tsx'

export const handle: SEOHandle & typeof formPageHandle = {
	getSitemapEntries: () => null,
	...formPageHandle,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({ timeZones: getTimeZoneOptions() })
}

export const meta: MetaFunction = () => {
	return [{ title: `Create New Recipient | GratiText` }]
}

export default function NewRecipientEditor() {
	const data = useLoaderData<typeof loader>()
	const { recipients, subscriptionStatus } =
		useOutletContext<RecipientsOutletContext>()
	return (
		<RecipientEditor
			timeZones={data.timeZones}
			reservedDays={getReservedDays({ recipients, subscriptionStatus })}
		/>
	)
}
