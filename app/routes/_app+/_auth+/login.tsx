import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import {
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	Form,
	Link,
	useActionData,
	useSearchParams,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { CheckboxField, ErrorList, Field } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { login, requireAnonymous } from '#app/utils/auth.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { PasswordSchema, UsernameSchema } from '#app/utils/user-validation.ts'
import { handleNewSession } from './login.server.ts'

const LoginFormSchema = z.object({
	username: UsernameSchema,
	password: PasswordSchema,
	redirectTo: z.string().optional(),
	remember: z.boolean().optional(),
})

export async function loader({ request }: LoaderFunctionArgs) {
	await requireAnonymous(request)
	return json({})
}

export async function action({ request }: ActionFunctionArgs) {
	await requireAnonymous(request)
	const formData = await request.formData()
	await checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: (intent) =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== null) return { ...data, session: null }

				const session = await login({
					identifier: data.username,
					password: data.password,
				})
				if (!session) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Invalid username or password',
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
		},
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: LoginFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="container flex flex-col items-center justify-center pt-20 pb-32">
			<div className="text-center">
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
					GratiText
				</p>
				<h1 className="text-h1 mt-3">Stay Close, Even When Apart</h1>
				<p className="text-body-md text-muted-foreground mt-3">
					Please enter your account details.
				</p>
			</div>
			<Spacer size="xs" />
			<div className="border-border bg-card mt-8 w-full max-w-lg rounded-[32px] border px-6 py-8 shadow-sm">
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					<HoneypotInputs />
					<Field
						labelProps={{ children: 'Username' }}
						inputProps={{
							...getInputProps(fields.username, { type: 'text' }),
							autoFocus: true,
							autoComplete: 'username',
						}}
						errors={fields.username.errors}
					/>

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
