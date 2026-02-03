import { generateSitemap } from '@nasa-gcn/remix-seo'
import { type LoaderFunctionArgs } from 'react-router'
import { getDomainUrl } from '#app/utils/misc.tsx'

type SitemapRoutes = Parameters<typeof generateSitemap>[1]

export async function loader({ request, context }: LoaderFunctionArgs) {
	const routes = context.serverBuild.routes as SitemapRoutes
	return generateSitemap(request, routes, {
		siteUrl: getDomainUrl(request),
		headers: {
			'Cache-Control': `public, max-age=${60 * 5}`,
		},
	})
}
