import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import {
	type ActionFunctionArgs,
	Form,
	Link,
	useActionData,
	useSearchParams,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import {
	AuthActions,
	AuthPage,
	authPageHandle,
} from '#app/components/auth-page.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, OTPField } from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
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

export const handle = authPageHandle

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

	const checkPhoneNumber = {
		title: 'Check Your Texts',
		description: "We've texted you a code to verify your phone number",
	}

	const headings: Record<
		VerificationTypes,
		{ title: string; description: string }
	> = {
		onboarding: checkPhoneNumber,
		'reset-password': checkPhoneNumber,
		'change-phone-number': checkPhoneNumber,
		'validate-recipient': {
			title: 'Ask Your Recipient for the Code',
			description:
				"We've texted a verification code to the number you gave us. Ask your recipient to share it with you.",
		},
		'2fa': {
			title: 'Check Your Authenticator App',
			description: 'Enter the 6-digit code from your 2FA app to continue',
		},
	}
	const heading = type
		? headings[type]
		: {
				title: 'Invalid verification link',
				description: 'This link is missing a verification type.',
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
		<AuthPage title={heading.title} description={heading.description}>
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-1 flex-col"
			>
				<HoneypotInputs />
				<ErrorList errors={form.errors} id={form.errorId} />
				<OTPField
					type="digits-and-characters"
					className="w-full"
					labelProps={{
						htmlFor: fields[codeQueryParam].id,
						children: 'Verification Code',
						className: 'block mb-3',
					}}
					inputProps={{
						...getInputProps(fields[codeQueryParam], { type: 'text' }),
						autoComplete: 'one-time-code',
						autoFocus: true,
						containerClassName: 'justify-between md:justify-start gap-2 md:gap-3',
					}}
					errors={fields[codeQueryParam].errors}
					groupClassName="gap-2 md:gap-3"
					slotClassName="h-11 w-11 text-base sm:h-14 sm:w-14 sm:text-lg"
				/>
				<input {...getInputProps(fields[typeQueryParam], { type: 'hidden' })} />
				<input
					{...getInputProps(fields[targetQueryParam], { type: 'hidden' })}
				/>
				<input
					{...getInputProps(fields[redirectToQueryParam], {
						type: 'hidden',
					})}
				/>
				<AuthActions
					aside={
						<p className="text-muted-foreground">
							{type === '2fa' ? 'Having trouble?' : 'No text after 5 minutes?'}{' '}
							<Link
								to={type ? resendRoutes[type] : '.'}
								className="font-semibold"
							>
								{type === '2fa' ? 'Back to login' : 'Resend the Code'}
							</Link>
						</p>
					}
				>
					<StatusButton
						size="lg"
						variant="brand"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						Continue
						<Icon name="arrow-right" size="sm" aria-hidden="true" />
					</StatusButton>
				</AuthActions>
			</Form>
		</AuthPage>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
