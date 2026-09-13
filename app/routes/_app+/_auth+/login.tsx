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
import { AuthPage } from '#app/components/auth-page.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { CheckboxField, ErrorList, Field } from '#app/components/forms.tsx'
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

	const signupTo = redirectTo
		? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
		: '/signup'

	return (
		<AuthPage
			title="Welcome back"
			description="Log in to keep the gratitude flowing."
			footer={
				<p>
					New here? <Link to={signupTo}>Create an account</Link>
				</p>
			}
		>
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
					<Link
						to="/forgot-password"
						className="text-foreground text-sm font-semibold underline-offset-4 hover:underline"
					>
						Forgot password?
					</Link>
				</div>

				<input {...getInputProps(fields.redirectTo, { type: 'hidden' })} />
				<ErrorList errors={form.errors} id={form.errorId} />

				<StatusButton
					variant="brand"
					className="w-full"
					status={isPending ? 'pending' : (form.status ?? 'idle')}
					type="submit"
					disabled={isPending}
				>
					Log in
				</StatusButton>
			</Form>
		</AuthPage>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Login to GratiText' }]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
