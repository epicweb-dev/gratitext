import {
	getFormProps,
	getInputProps,
	getSelectProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form, Link, useActionData, useSearchParams } from '@remix-run/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { CheckboxField, ErrorList, Field, SelectField } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { login, requireAnonymous } from '#app/utils/auth.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { PasswordSchema } from '#app/utils/user-validation.ts'
import { handleNewSession } from './login.server.ts'

const LoginFormSchema = z.object({
	countryCode: z.string().min(1, 'Country code is required'),
	phoneNumber: z.string().min(1, 'Phone number is required'),
	password: PasswordSchema,
	redirectTo: z.string().optional(),
	remember: z.boolean().optional(),
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
	if (/[a-z]/i.test(raw) || raw.startsWith('+') || raw.includes('-')) {
		return raw
	}
	return `${countryCode}${raw}`.replace(/\s+/g, '')
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireAnonymous(request)
	return json({})
}

export async function action({ request }: ActionFunctionArgs) {
	await requireAnonymous(request)
	const formData = await request.formData()
	checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: (intent) =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== null) return { ...data, session: null }

				const identifier = getIdentifier(data)
				const session = await login({ identifier, password: data.password })
				if (!session) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Invalid phone number or password',
					})
					return z.NEVER
				}

				return { ...data, session }
			}),
		async: true,
	})

	if (submission.status !== 'success' || !submission.value.session) {
		return json(
			{ result: submission.reply({ hideFields: ['password'] }) },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { session, remember, redirectTo } = submission.value

	return handleNewSession({
		request,
		session,
		remember: remember ?? false,
		redirectTo,
	})
}

export default function LoginPage() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [searchParams] = useSearchParams()
	const redirectTo = searchParams.get('redirectTo')

	const [form, fields] = useForm({
		id: 'login-form',
		constraint: getZodConstraint(LoginFormSchema),
		defaultValue: {
			redirectTo,
			countryCode: countryCodes[0]?.value ?? '+1',
		},
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: LoginFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="container flex flex-col items-center justify-center pb-32 pt-20">
			<div className="text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
					GratiText
				</p>
				<h1 className="mt-3 text-h1">Stay Close, Even When Apart</h1>
				<p className="mt-3 text-body-md text-muted-foreground">
					Please enter your account details.
				</p>
			</div>
			<Spacer size="xs" />
			<div className="mt-8 w-full max-w-lg rounded-[32px] border border-border bg-card px-6 py-8 shadow-sm">
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					<HoneypotInputs />
					<div className="grid gap-4 md:grid-cols-[200px_1fr]">
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
							labelProps={{ children: 'Phone Number' }}
							inputProps={{
								...getInputProps(fields.phoneNumber, { type: 'text' }),
								autoFocus: true,
								autoComplete: 'tel',
							}}
							errors={fields.phoneNumber.errors}
						/>
					</div>

					<Field
						labelProps={{ children: 'Password' }}
						inputProps={{
							...getInputProps(fields.password, {
								type: 'password',
							}),
							autoComplete: 'current-password',
						}}
						errors={fields.password.errors}
					/>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<CheckboxField
							labelProps={{
								htmlFor: fields.remember.id,
								children: 'Remember me',
							}}
							buttonProps={getInputProps(fields.remember, {
								type: 'checkbox',
							})}
							errors={fields.remember.errors}
						/>
						<Link to="/forgot-password" className="text-body-xs font-semibold">
							Forgot password?
						</Link>
					</div>

					<input {...getInputProps(fields.redirectTo, { type: 'hidden' })} />
					<ErrorList errors={form.errors} id={form.errorId} />

					<StatusButton
						className="w-full bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						Log in
					</StatusButton>
				</Form>
				<div className="flex items-center justify-center gap-2 pt-6">
					<span className="text-muted-foreground">New here?</span>
					<Link
						to={
							redirectTo
								? `/signup?${encodeURIComponent(redirectTo)}`
								: '/signup'
						}
					>
						Create an account
					</Link>
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Login to GratiText' }]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
