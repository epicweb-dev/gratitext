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
	useActionData,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
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
		<div className="container flex flex-col items-center justify-center pt-20 pb-32">
			<div className="text-center">
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
					GratiText
				</p>
				<h1 className="text-h1 mt-3">
					Create and Nurture Lasting Bonds With Your Loved Ones
				</h1>
				<p className="text-body-md text-muted-foreground mt-3">
					Please enter your phone number along with your country code.
				</p>
			</div>
			<div className="border-border bg-card mt-8 w-full max-w-lg rounded-[32px] border px-6 py-8 shadow-sm">
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					<HoneypotInputs />
					<div className="grid gap-4 md:grid-cols-[200px_1fr]">
						<SelectField
							labelProps={{ children: 'Country Code' }}
							selectProps={{
								...getSelectProps(fields.countryCode),
								children: countryCodes.map((code) => (
									<option
										key={`${code.value}-${code.label}`}
										value={code.value}
									>
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
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
