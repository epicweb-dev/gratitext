import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import * as QRCode from 'qrcode'
import {
	Form,
	data as json,
	redirect,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
	useActionData,
	useLoaderData,
	useNavigation,
} from 'react-router'
import { z } from 'zod'
import { ErrorList, OTPField } from '#app/components/forms.tsx'
import { SettingsCard } from '#app/components/settings-card.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { isCodeValid } from '#app/routes/_app+/_auth+/verify.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getDomainUrl, useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { getTOTPAuthUri } from '#app/utils/totp.server.ts'
import { twoFAVerificationType } from './two-factor.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const CancelSchema = z.object({ intent: z.literal('cancel') })
const VerifySchema = z.object({
	intent: z.literal('verify'),
	code: z.string().min(6).max(6),
})

const ActionSchema = z.discriminatedUnion('intent', [
	CancelSchema,
	VerifySchema,
])

export const twoFAVerifyVerificationType = '2fa-verify'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const verification = await prisma.verification.findUnique({
		where: {
			target_type: { type: twoFAVerifyVerificationType, target: userId },
		},
		select: {
			id: true,
			algorithm: true,
			secret: true,
			period: true,
			digits: true,
		},
	})
	if (!verification) {
		return redirect('/settings/profile/two-factor')
	}
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { phoneNumber: true },
	})
	const issuer = new URL(getDomainUrl(request)).host
	const otpUri = await getTOTPAuthUri({
		...verification,
		accountName: user.phoneNumber,
		issuer,
	})
	const qrCode = await QRCode.toDataURL(otpUri)
	return json({ otpUri, qrCode })
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()

	const submission = await parseWithZod(formData, {
		schema: () =>
			ActionSchema.superRefine(async (data, ctx) => {
				if (data.intent === 'cancel') return
				const codeIsValid = await isCodeValid({
					code: data.code,
					type: twoFAVerifyVerificationType,
					target: userId,
				})
				if (!codeIsValid) {
					ctx.addIssue({
						path: ['code'],
						code: z.ZodIssueCode.custom,
						message: `Invalid code`,
					})
					return z.NEVER
				}
			}),
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	switch (submission.value.intent) {
		case 'cancel': {
			await prisma.verification.deleteMany({
				where: { type: twoFAVerifyVerificationType, target: userId },
			})
			return redirect('/settings/profile/two-factor')
		}
		case 'verify': {
			await prisma.verification.update({
				where: {
					target_type: { type: twoFAVerifyVerificationType, target: userId },
				},
				data: { type: twoFAVerificationType },
			})
			return redirectWithToast('/settings/profile/two-factor', {
				type: 'success',
				title: 'Enabled',
				description: 'Two-factor authentication has been enabled.',
			})
		}
	}
}

export default function TwoFactorRoute() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()

	const isPending = useIsPending()
	const pendingIntent = isPending ? navigation.formData?.get('intent') : null

	const [form, fields] = useForm({
		id: 'verify-form',
		constraint: getZodConstraint(ActionSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ActionSchema })
		},
	})
	const lastSubmissionIntent = fields.intent.value

	return (
		<SettingsCard
			title="Set up your authenticator app"
			backTo="/settings/profile/two-factor"
			backLabel="Back to two-factor settings"
			description="Follow these steps to finish enabling two-factor authentication."
		>
			<ol className="flex flex-col gap-8">
				<li className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
					<StepNumber n={1} />
					<div className="flex flex-1 flex-col gap-4">
						<div>
							<h2 className="text-foreground font-semibold">
								Scan this QR code with your authenticator app
							</h2>
							<p className="text-muted-foreground mt-1 text-sm">
								Any TOTP app works, such as 1Password, Google Authenticator, or
								Authy.
							</p>
						</div>
						<img
							alt="QR code for your authenticator app"
							src={data.qrCode}
							className="border-border h-48 w-48 rounded-2xl border bg-white p-2"
						/>
						<div>
							<p className="text-muted-foreground text-sm">
								Can't scan it? Add the account manually with this setup key:
							</p>
							<pre
								className="bg-muted text-muted-foreground mt-2 rounded-2xl px-4 py-3 font-mono text-xs break-all whitespace-pre-wrap"
								aria-label="One-time Password URI"
							>
								{data.otpUri}
							</pre>
						</div>
					</div>
				</li>
				<li className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
					<StepNumber n={2} />
					<div className="flex flex-1 flex-col gap-4">
						<div>
							<h2 className="text-foreground font-semibold">
								Enter the 6-digit code from the app
							</h2>
							<p className="text-muted-foreground mt-1 text-sm">
								After this, you will need a code from your authenticator app
								every time you log in. Do not lose access to it, or you will
								lose access to your account.
							</p>
						</div>
						<Form method="POST" {...getFormProps(form)}>
							<OTPField
								type="digits"
								labelProps={{
									htmlFor: fields.code.id,
									children: 'Code',
								}}
								inputProps={{
									...getInputProps(fields.code, { type: 'text' }),
									autoFocus: true,
									autoComplete: 'one-time-code',
								}}
								errors={fields.code.errors}
							/>
							<ErrorList id={form.errorId} errors={form.errors} />
							<div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">
								<StatusButton
									variant="outline"
									status={
										pendingIntent === 'cancel'
											? 'pending'
											: lastSubmissionIntent === 'cancel'
												? (form.status ?? 'idle')
												: 'idle'
									}
									type="submit"
									name="intent"
									value="cancel"
									disabled={isPending}
								>
									Cancel
								</StatusButton>
								<StatusButton
									variant="brand"
									status={
										pendingIntent === 'verify'
											? 'pending'
											: lastSubmissionIntent === 'verify'
												? (form.status ?? 'idle')
												: 'idle'
									}
									type="submit"
									name="intent"
									value="verify"
								>
									Submit
								</StatusButton>
							</div>
						</Form>
					</div>
				</li>
			</ol>
		</SettingsCard>
	)
}

function StepNumber({ n }: { n: number }) {
	return (
		<span
			aria-hidden="true"
			className="bg-brand text-brand-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
		>
			{n}
		</span>
	)
}
