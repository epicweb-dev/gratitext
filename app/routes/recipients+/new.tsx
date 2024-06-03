import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server.ts'
import { RecipientEditor } from './__editor.tsx'

export { action } from './__editor.server.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({})
}

export const meta: MetaFunction = () => {
	return [{ title: `Create New Recipient | GratiText` }]
}

export default RecipientEditor
