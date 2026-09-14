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
import {
	FormActions,
	FormPage,
	authPageHandle,
} from '#app/components/form-page.tsx'
import {
	CheckboxField,
	ErrorList,
	Field,
	PasswordField,
} from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { login, requireAnonymous } from '#app/utils/auth.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { PasswordSchema } from '#app/utils/user-validation.ts'
import { handleNewSession } from './login.server.ts'

// Accepts a username or a phone number in any common format; `login` tries
// both, so this stays looser than `UsernameSchema`.
const LoginIdentifierSchema = z
	.string({ error: 'Username or phone number is required' })
	.transform((value) => value.trim())
	.pipe(
		z
			.string()
			.min(3, { message: 'Username or phone number is too short' })
			.max(30, { message: 'Username or phone number is too long' }),
	)

const LoginFormSchema = z.object({
	username: LoginIdentifierSchema,
	password: PasswordSchema,
	redirectTo: z.string().optional(),
	remember: z.boolean().optional(),
})

export const handle = authPageHandle

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
		<FormPage
			title="Stay Close, Even When Apart"
			description="Please enter your username or phone number and password"
			footer={
				<p>
					New here? <Link to={signupTo}>Create an account</Link>
				</p>
			}
		>
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-1 flex-col"
			>
				<HoneypotInputs />
				<Field
					labelProps={{ children: 'Username or Phone Number' }}
					inputProps={{
						...getInputProps(fields.username, { type: 'text' }),
						autoFocus: true,
						autoComplete: 'username',
					}}
					errors={fields.username.errors}
				/>
				<PasswordField
					labelProps={{ children: 'Password' }}
					inputProps={{
						...getInputProps(fields.password, { type: 'password' }),
						autoComplete: 'current-password',
					}}
					errors={fields.password.errors}
				/>
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
				<input {...getInputProps(fields.redirectTo, { type: 'hidden' })} />
				<ErrorList errors={form.errors} id={form.errorId} />
				<FormActions
					aside={<Link to="/forgot-password">Forgot Password?</Link>}
				>
					<StatusButton
						variant="brand"
						size="lg"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						Log In
						<Icon name="arrow-right" size="sm" aria-hidden="true" />
					</StatusButton>
				</FormActions>
			</Form>
		</FormPage>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Login to GratiText' }]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
