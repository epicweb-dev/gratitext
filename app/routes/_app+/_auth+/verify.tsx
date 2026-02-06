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

	const headingClasses = 'text-h2 sm:text-h1'
	const bodyClasses = 'text-body-md text-muted-foreground mt-4'
	const buildHeading = (title: string, description: string) => (
		<>
			<h1 className={headingClasses}>{title}</h1>
			<p className={bodyClasses}>{description}</p>
		</>
	)
	const checkPhoneNumber = buildHeading(
		'Check Your Texts',
		"We've texted you a code to verify your phone number",
	)

	const headings: Record<VerificationTypes, React.ReactNode> = {
		onboarding: checkPhoneNumber,
		'reset-password': checkPhoneNumber,
		'change-phone-number': checkPhoneNumber,
		'validate-recipient': buildHeading(
			'Check Your Texts',
			"We've texted you a code to verify the phone number you gave us. Please inform your recipient of what you're up to and ask your recipient to provide you with that code.",
		),
		'2fa': buildHeading(
			'Check Your 2FA App',
			'Please enter your 2FA code to verify your identity.',
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
		<main className="container flex flex-col items-center justify-start pt-12 pb-24 sm:pt-16">
			<div className="max-w-lg text-center">
				{type ? headings[type] : 'Invalid Verification Type'}
			</div>

			<div className="mt-10 w-full max-w-md">
				<Form method="POST" {...getFormProps(form)} className="space-y-8">
					<HoneypotInputs />
					<ErrorList errors={form.errors} id={form.errorId} />
					<OTPField
						type="digits-and-characters"
						className="w-full"
						labelProps={{
							htmlFor: fields[codeQueryParam].id,
							children: 'Verification Code',
							className:
								'text-body-sm font-semibold tracking-normal normal-case text-foreground block mb-3',
						}}
						inputProps={{
							...getInputProps(fields[codeQueryParam], { type: 'text' }),
							autoComplete: 'one-time-code',
							autoFocus: true,
							containerClassName:
								'justify-center gap-2 sm:justify-start sm:gap-3',
						}}
						errors={fields[codeQueryParam].errors}
						groupClassName="gap-2 sm:gap-3"
						showSeparator={false}
						slotClassName="bg-card text-foreground h-11 w-11 rounded-full text-base font-semibold shadow-none sm:h-14 sm:w-14 sm:text-lg"
					/>
					<div className="text-body-sm text-muted-foreground flex flex-wrap items-center gap-1">
						<span>No text after 5 minutes?</span>
						<Link
							to={type ? resendRoutes[type] : '.'}
							className="text-foreground hover:text-foreground/90 font-semibold"
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
						size="lg"
						variant="brand"
						className="w-full"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						<span className="inline-flex items-center gap-3">
							Continue
							<Icon name="arrow-right" size="sm" aria-hidden="true" />
						</span>
					</StatusButton>
				</Form>
			</div>
		</main>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
