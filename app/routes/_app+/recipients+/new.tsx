import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	Link,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
} from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
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

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
			<Link
				to="/recipients"
				className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm font-semibold transition-colors"
			>
				<Icon name="arrow-left" size="sm" aria-hidden="true" />
				All recipients
			</Link>
			<div className="border-border bg-card rounded-[32px] border p-5 shadow-sm sm:p-8">
				<RecipientEditor supportedTimeZones={data.supportedTimeZones} />
			</div>
		</div>
	)
}
