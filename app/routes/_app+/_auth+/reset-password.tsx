import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import {
	data as json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	Form,
	useActionData,
	useLoaderData,
} from 'react-router'
import {
	AuthActions,
	AuthPage,
	authPageHandle,
} from '#app/components/auth-page.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, PasswordField } from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireAnonymous, resetUserPassword } from '#app/utils/auth.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { PasswordAndConfirmPasswordSchema } from '#app/utils/user-validation.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'

export const resetPasswordUsernameSessionKey = 'resetPasswordUsername'

const ResetPasswordSchema = PasswordAndConfirmPasswordSchema

async function requireResetPasswordUsername(request: Request) {
	await requireAnonymous(request)
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const resetPasswordUsername = verifySession.get(
		resetPasswordUsernameSessionKey,
	)
	if (typeof resetPasswordUsername !== 'string' || !resetPasswordUsername) {
		throw redirect('/login')
	}
	return resetPasswordUsername
}

export async function loader({ request }: LoaderFunctionArgs) {
	const resetPasswordUsername = await requireResetPasswordUsername(request)
	return json({ resetPasswordUsername })
}

export async function action({ request }: ActionFunctionArgs) {
	const resetPasswordUsername = await requireResetPasswordUsername(request)
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: ResetPasswordSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { password } = submission.value

	await resetUserPassword({ username: resetPasswordUsername, password })
	const verifySession = await verifySessionStorage.getSession()
	return redirect('/login', {
		headers: {
			'set-cookie': await verifySessionStorage.destroySession(verifySession),
		},
	})
}

export const meta: MetaFunction = () => {
	return [{ title: 'Reset Password | GratiText' }]
}

export const handle = authPageHandle

export default function ResetPasswordPage() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'reset-password',
		constraint: getZodConstraint(ResetPasswordSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ResetPasswordSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<AuthPage
			title="Reset Your Password"
			description={`Hi ${data.resetPasswordUsername}, let's set a new password`}
		>
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-1 flex-col"
			>
				<PasswordField
					labelProps={{
						htmlFor: fields.password.id,
						children: 'New Password',
					}}
					inputProps={{
						...getInputProps(fields.password, { type: 'password' }),
						autoComplete: 'new-password',
						autoFocus: true,
					}}
					errors={fields.password.errors}
				/>
				<PasswordField
					labelProps={{
						htmlFor: fields.confirmPassword.id,
						children: 'Confirm Password',
					}}
					inputProps={{
						...getInputProps(fields.confirmPassword, { type: 'password' }),
						autoComplete: 'new-password',
					}}
					errors={fields.confirmPassword.errors}
				/>
				<ErrorList errors={form.errors} id={form.errorId} />
				<AuthActions>
					<StatusButton
						variant="brand"
						size="lg"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						Reset Password
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
