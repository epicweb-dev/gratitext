import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	useFetcher,
} from 'react-router'
import { SettingsCard } from '#app/components/settings-card.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireRecentVerification } from '#app/routes/_app+/_auth+/verify.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { twoFAVerificationType } from './two-factor.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireRecentVerification(request)
	return json({})
}

export async function action({ request }: ActionFunctionArgs) {
	await requireRecentVerification(request)
	const userId = await requireUserId(request)
	await prisma.verification.delete({
		where: { target_type: { target: userId, type: twoFAVerificationType } },
	})
	return redirectWithToast('/settings/profile/two-factor', {
		title: '2FA Disabled',
		description: 'Two factor authentication has been disabled.',
	})
}

export default function TwoFactorDisableRoute() {
	const disable2FAFetcher = useFetcher<typeof action>()
	const dc = useDoubleCheck()

	return (
		<SettingsCard
			title="Disable two-factor authentication"
			backTo="/settings/profile/two-factor"
			description="We do not recommend this. Without 2FA, anyone who learns your password can log in to your account."
		>
			<disable2FAFetcher.Form
				method="POST"
				className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-start"
			>
				<ButtonLink variant="outline" to="..">
					Keep 2FA on
				</ButtonLink>
				<StatusButton
					variant="destructive"
					status={disable2FAFetcher.state !== 'idle' ? 'pending' : 'idle'}
					{...dc.getButtonProps({
						name: 'intent',
						value: 'disable',
						type: 'submit',
					})}
				>
					<Icon name="lock-open-1" size="sm" aria-hidden="true" />
					{dc.doubleCheck ? 'Are you sure?' : 'Disable 2FA'}
				</StatusButton>
			</disable2FAFetcher.Form>
		</SettingsCard>
	)
}
