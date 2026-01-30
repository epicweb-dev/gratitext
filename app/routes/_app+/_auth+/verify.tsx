import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import {
	type ActionFunctionArgs,
	Form,
	Link,
	useActionData,
	useSearchParams,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, OTPField } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { validateRequest } from './verify.server.ts'

export const codeQueryParam = 'code'
export const targetQueryParam = 'target'
export const typeQueryParam = 'type'
export const redirectToQueryParam = 'redirectTo'
const types = [
	'onboarding',
	'reset-password',
	'change-phone-number',
	'2fa',
	'validate-recipient',
] as const
const VerificationTypeSchema = z.enum(types)
export type VerificationTypes = z.infer<typeof VerificationTypeSchema>

export const VerifySchema = z.object({
	[codeQueryParam]: z.string().min(6).max(6),
	[typeQueryParam]: VerificationTypeSchema,
	[targetQueryParam]: z.string(),
	[redirectToQueryParam]: z.string().optional(),
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	await checkHoneypot(formData)
	return validateRequest(request, formData)
}

export default function VerifyRoute() {
	const [searchParams] = useSearchParams()
	const isPending = useIsPending()
	const actionData = useActionData<typeof action>()
	const parseWithZoddType = VerificationTypeSchema.safeParse(
		searchParams.get(typeQueryParam),
	)
	const type = parseWithZoddType.success ? parseWithZoddType.data : null

	const checkPhoneNumber = (
		<>
			<h1 className="text-h1">Check your texts</h1>
			<p className="text-body-md text-muted-foreground mt-3">
				We've texted you a code to verify your phone number.
			</p>
		</>
	)

	const headings: Record<VerificationTypes, React.ReactNode> = {
		onboarding: checkPhoneNumber,
		'reset-password': checkPhoneNumber,
		'change-phone-number': checkPhoneNumber,
		'validate-recipient': (
			<>
				<h1 className="text-h1">Check your texts</h1>
				<p className="text-body-md text-muted-foreground mt-3">
					We've texted you a code to verify the phone number you gave us. Please
					inform your recipient of what you're up to and ask your recipient to
					provide you with that code.
				</p>
			</>
		),
		'2fa': (
			<>
				<h1 className="text-h1">Check your 2FA app</h1>
				<p className="text-body-md text-muted-foreground mt-3">
					Please enter your 2FA code to verify your identity.
				</p>
			</>
		),
	}

	const resendRoutes: Record<VerificationTypes, string> = {
		onboarding: '/signup',
		'reset-password': '/forgot-password',
		'change-phone-number': '/settings/profile/change-number',
		'2fa': '/login',
		'validate-recipient': '/recipients',
	}

	const [form, fields] = useForm({
		id: 'verify-form',
		constraint: getZodConstraint(VerifySchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: VerifySchema })
		},
		defaultValue: {
			code: searchParams.get(codeQueryParam),
			type: type,
			target: searchParams.get(targetQueryParam),
			redirectTo: searchParams.get(redirectToQueryParam),
		},
	})

	return (
		<main className="container flex flex-col items-center justify-center pt-20 pb-32">
			<div className="text-center">
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
					GratiText
				</p>
				{type ? headings[type] : 'Invalid Verification Type'}
			</div>

			<Spacer size="xs" />

			<div className="border-border bg-card mt-8 w-full max-w-md rounded-[32px] border px-6 py-8 shadow-sm">
				<ErrorList errors={form.errors} id={form.errorId} />
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					<HoneypotInputs />
					<div className="flex items-center justify-center">
						<OTPField
							type="digits-and-characters"
							labelProps={{
								htmlFor: fields[codeQueryParam].id,
								children: 'Verification Code',
							}}
							inputProps={{
								...getInputProps(fields[codeQueryParam], { type: 'text' }),
								autoComplete: 'one-time-code',
								autoFocus: true,
							}}
							errors={fields[codeQueryParam].errors}
						/>
					</div>
					<div className="text-body-xs text-muted-foreground text-center">
						<span>Didn't get it? </span>
						<Link
							to={type ? resendRoutes[type] : '.'}
							className="text-foreground font-semibold underline"
						>
							Resend the Code
						</Link>
					</div>
					<input
						{...getInputProps(fields[typeQueryParam], { type: 'hidden' })}
					/>
					<input
						{...getInputProps(fields[targetQueryParam], { type: 'hidden' })}
					/>
					<input
						{...getInputProps(fields[redirectToQueryParam], {
							type: 'hidden',
						})}
					/>
					<StatusButton
						className="w-full bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						Continue
					</StatusButton>
				</Form>
			</div>
		</main>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
