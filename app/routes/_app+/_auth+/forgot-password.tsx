import {
	getFormProps,
	getInputProps,
	getSelectProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import {
	data as json,
	redirect,
	type ActionFunctionArgs,
	type MetaFunction,
	Link,
	useFetcher,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { AuthPage } from '#app/components/auth-page.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field, SelectField } from '#app/components/forms.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { sendText } from '#app/utils/text.server.js'
import { PhoneNumberSchema } from '#app/utils/user-validation.ts'
import { prepareVerification } from './verify.server.ts'

const ForgotPasswordSchema = z.object({
	countryCode: z.string().min(1, 'Country code is required'),
	phoneNumber: PhoneNumberSchema,
})

const countryCodes = [
	{ label: 'United States (+1)', value: '+1' },
	{ label: 'United Kingdom (+44)', value: '+44' },
	{ label: 'Czech Republic (+420)', value: '+420' },
	{ label: 'Canada (+1)', value: '+1' },
	{ label: 'Australia (+61)', value: '+61' },
]

function getIdentifier({
	countryCode,
	phoneNumber,
}: {
	countryCode: string
	phoneNumber: string
}) {
	const raw = phoneNumber.trim()
	if (/[a-z]/i.test(raw)) {
		return raw
	}
	// Extract digits only and prepend country code
	const digitsOnly = raw.replace(/\D/g, '')
	if (raw.startsWith('+')) {
		return `+${digitsOnly}`
	}
	return `${countryCode}${digitsOnly}`.replace(/\s+/g, '')
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	await checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: ForgotPasswordSchema.superRefine(async (data, ctx) => {
			const identifier = getIdentifier({
				countryCode: data.countryCode,
				phoneNumber: data.phoneNumber,
			})
			const user = await prisma.user.findFirst({
				where: {
					OR: [{ phoneNumber: identifier }, { username: identifier }],
				},
				select: { id: true },
			})
			if (!user) {
				ctx.addIssue({
					path: ['phoneNumber'],
					code: z.ZodIssueCode.custom,
					message: 'No user exists with this username or phone number',
				})
				return
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
	const identifier = getIdentifier(submission.value)

	const user = await prisma.user.findFirstOrThrow({
		where: {
			OR: [{ phoneNumber: identifier }, { username: identifier }],
		},
		select: { phoneNumber: true, username: true },
	})

	const { verifyUrl, redirectTo, otp } = await prepareVerification({
		period: 10 * 60,
		request,
		type: 'reset-password',
		target: identifier,
	})

	const response = await sendText({
		to: user.phoneNumber,
		message: `GratiText Password reset confirmation code: ${otp}\n\nOr open this link: ${verifyUrl}`,
	})

	if (response.status === 'success') {
		return redirect(redirectTo.toString())
	} else {
		return json(
			{ result: submission.reply({ formErrors: [response.error] }) },
			{ status: 500 },
		)
	}
}

export const meta: MetaFunction = () => {
	return [{ title: 'Password Recovery for GratiText' }]
}

export default function ForgotPasswordRoute() {
	const forgotPassword = useFetcher<typeof action>()

	const [form, fields] = useForm({
		id: 'forgot-password-form',
		constraint: getZodConstraint(ForgotPasswordSchema),
		defaultValue: { countryCode: countryCodes[0]?.value ?? '+1' },
		lastResult: forgotPassword.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ForgotPasswordSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<AuthPage
			title="Forgot password?"
			description="No worries. Enter the phone number on your account and we'll text you a reset code."
			footer={
				<p>
					Remembered it? <Link to="/login">Back to login</Link>
				</p>
			}
		>
			<forgotPassword.Form
				method="POST"
				{...getFormProps(form)}
				className="space-y-6"
			>
				<HoneypotInputs />
				<div className="grid gap-4 sm:grid-cols-[200px_1fr]">
					<SelectField
						labelProps={{ children: 'Country Code' }}
						selectProps={{
							...getSelectProps(fields.countryCode),
							children: countryCodes.map((code) => (
								<option key={`${code.value}-${code.label}`} value={code.value}>
									{code.label}
								</option>
							)),
						}}
						errors={fields.countryCode.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.phoneNumber.id,
							children: 'Phone Number',
						}}
						inputProps={{
							autoFocus: true,
							...getInputProps(fields.phoneNumber, {
								type: 'text',
							}),
						}}
						errors={fields.phoneNumber.errors}
					/>
				</div>
				<ErrorList errors={form.errors} id={form.errorId} />
				<StatusButton
					variant="brand"
					className="w-full"
					status={
						forgotPassword.state === 'submitting'
							? 'pending'
							: (form.status ?? 'idle')
					}
					type="submit"
					disabled={forgotPassword.state !== 'idle'}
				>
					Recover password
				</StatusButton>
			</forgotPassword.Form>
		</AuthPage>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
