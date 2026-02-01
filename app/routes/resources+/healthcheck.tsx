// learn more: https://fly.io/docs/reference/configuration/#services-http_checks
import { type LoaderFunctionArgs } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'

export async function loader(_args: LoaderFunctionArgs) {
	try {
		// If we can connect and run a trivial query, then we're good.
		await prisma.$queryRaw`SELECT 1`
		return new Response('OK')
	} catch (error: unknown) {
		console.log('healthcheck ❌', { error })
		return new Response('ERROR', { status: 500 })
	}
}
