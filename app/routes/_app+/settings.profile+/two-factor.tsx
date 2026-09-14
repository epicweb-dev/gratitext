import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Outlet, useOutletContext } from 'react-router'
import { type VerificationTypes } from '#app/routes/_app+/_auth+/verify.tsx'
import { type SettingsOutletContext } from './_layout.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export const twoFAVerificationType = '2fa' satisfies VerificationTypes

export default function TwoFactorRoute() {
	// Pass the settings context through so the nested pages can render the
	// overview behind their dialog.
	const context = useOutletContext<SettingsOutletContext>()
	return <Outlet context={context} />
}
