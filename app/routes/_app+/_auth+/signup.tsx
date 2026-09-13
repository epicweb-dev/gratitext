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
	Form,
	Link,
	useActionData,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { AuthPage } from '#app/components/auth-page.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field, SelectField } from '#app/components/forms.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { sendText } from '#app/utils/text.server.js'
import { PhoneNumberSchema } from '#app/utils/user-validation.ts'
import { prepareVerification } from './verify.server.ts'

const SignupSchema = z.object({
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

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()

	await checkHoneypot(formData)

	const submission = await parseWithZod(formData, {
		schema: SignupSchema.superRefine(async (data, ctx) => {
			const digitsOnly = data.phoneNumber.replace(/\D/g, '')
			const fullPhoneNumber = `${data.countryCode}${digitsOnly}`.replace(
				/\s+/g,
				'',
			)
			const existingUser = await prisma.user.findUnique({
				where: { phoneNumber: fullPhoneNumber },
				select: { id: true },
			})
			if (existingUser) {
				ctx.addIssue({
					path: ['phoneNumber'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this phone number',
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

	if (process.env.PRE_LAUNCH === 'true') {
		return json({
			result: submission.reply({
				formErrors: [
					`This app is still in the pre-launch phase and you cannot sign up yet. Please check back later!`,
				],
			}),
		})
	}

	const { phoneNumber, countryCode } = submission.value
	const digitsOnly = phoneNumber.replace(/\D/g, '')
	const fullPhoneNumber = `${countryCode}${digitsOnly}`.replace(/\s+/g, '')
	const { verifyUrl, redirectTo, otp } = await prepareVerification({
		period: 10 * 60,
		request,
		type: 'onboarding',
		target: fullPhoneNumber,
	})

	const response = await sendText({
		to: fullPhoneNumber,
		message: `Welcome to GratiText!\nHere's your verification code: ${otp}\n\nOr click the link to get started: ${verifyUrl}`,
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
	return [{ title: 'Sign Up | GratiText' }]
}

export default function SignupRoute() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'signup-form',
		constraint: getZodConstraint(SignupSchema),
		defaultValue: { countryCode: countryCodes[0]?.value ?? '+1' },
		lastResult: actionData?.result,
		onValidate({ formData }) {
			const result = parseWithZod(formData, { schema: SignupSchema })
			return result
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<AuthPage
			title="Create your account"
			description="Enter your mobile number and we'll text you a code to get started. Your first 14 days are free."
			footer={
				<p>
					Already have an account? <Link to="/login">Log in</Link>
				</p>
			}
		>
			<Form method="POST" {...getFormProps(form)} className="space-y-6">
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
							...getInputProps(fields.phoneNumber, { type: 'tel' }),
							autoFocus: true,
							autoComplete: 'tel',
						}}
						errors={fields.phoneNumber.errors}
					/>
				</div>
				<ErrorList errors={form.errors} id={form.errorId} />
				<StatusButton
					variant="brand"
					className="w-full"
					status={isPending ? 'pending' : (form.status ?? 'idle')}
					type="submit"
					disabled={isPending}
				>
					Continue
				</StatusButton>
			</Form>
		</AuthPage>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
