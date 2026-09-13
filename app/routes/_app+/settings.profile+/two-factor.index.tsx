import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	useFetcher,
	useLoaderData,
} from 'react-router'
import { SettingsCard } from '#app/components/settings-card.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { generateTOTP } from '#app/utils/totp.server.ts'
import { twoFAVerificationType } from './two-factor.tsx'
import { twoFAVerifyVerificationType } from './two-factor.verify.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const verification = await prisma.verification.findUnique({
		where: { target_type: { type: twoFAVerificationType, target: userId } },
		select: { id: true },
	})
	return json({ is2FAEnabled: Boolean(verification) })
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const { otp: _otp, ...config } = await generateTOTP()
	const verificationData = {
		...config,
		type: twoFAVerifyVerificationType,
		target: userId,
	}
	await prisma.verification.upsert({
		where: {
			target_type: { target: userId, type: twoFAVerifyVerificationType },
		},
		create: verificationData,
		update: verificationData,
	})
	return redirect('/settings/profile/two-factor/verify')
}

export default function TwoFactorRoute() {
	const data = useLoaderData<typeof loader>()
	const enable2FAFetcher = useFetcher<typeof action>()

	return (
		<SettingsCard
			title="Two-factor authentication"
			description="Protect your account with a code from an authenticator app every time you log in."
		>
			{data.is2FAEnabled ? (
				<div className="flex flex-col gap-5">
					<div className="bg-brand-soft text-brand-soft-foreground flex items-start gap-3 rounded-2xl px-4 py-3 text-sm">
						<Icon
							name="check"
							size="sm"
							className="mt-0.5 shrink-0"
							aria-hidden="true"
						/>
						<p className="font-medium">
							You have enabled two-factor authentication.
						</p>
					</div>
					<p className="text-muted-foreground text-sm">
						Keep your authenticator app safe. If you lose access to it, you will
						not be able to log in.
					</p>
					<div>
						<ButtonLink variant="secondary" to="disable">
							<Icon name="lock-open-1" size="sm" aria-hidden="true" />
							Disable 2FA
						</ButtonLink>
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-5">
					<div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-2xl px-4 py-3 text-sm">
						<Icon
							name="lock-open-1"
							size="sm"
							className="mt-0.5 shrink-0"
							aria-hidden="true"
						/>
						<p className="font-medium">
							You have not enabled two-factor authentication yet.
						</p>
					</div>
					<p className="text-muted-foreground text-sm">
						Two-factor authentication adds an extra layer of security. You will
						need to enter a code from an authenticator app like{' '}
						<a
							className="text-foreground underline underline-offset-4"
							href="https://1password.com/"
							target="_blank"
							rel="noreferrer"
						>
							1Password
						</a>{' '}
						or Google Authenticator to log in.
					</p>
					<enable2FAFetcher.Form method="POST">
						<StatusButton
							type="submit"
							name="intent"
							value="enable"
							variant="brand"
							status={enable2FAFetcher.state !== 'idle' ? 'pending' : 'idle'}
						>
							<Icon name="lock-closed" size="sm" aria-hidden="true" />
							Enable 2FA
						</StatusButton>
					</enable2FAFetcher.Form>
				</div>
			)}
		</SettingsCard>
	)
}
