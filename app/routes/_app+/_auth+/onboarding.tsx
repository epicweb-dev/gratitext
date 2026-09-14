import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import {
	data as json,
	redirect,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
	type MetaFunction,
	Form,
	Link,
	useActionData,
	useSearchParams,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { z } from 'zod'
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
import { requireAnonymous, sessionKey, signup } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import {
	NameSchema,
	PasswordAndConfirmPasswordSchema,
	UsernameSchema,
} from '#app/utils/user-validation.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'

export const onboardingPhoneNumberSessionKey = 'onboardingPhoneNumber'

const SignupFormSchema = z
	.object({
		username: UsernameSchema,
		name: NameSchema,
		agreeToTermsOfServiceAndPrivacyPolicy: z.boolean({
			error: 'You must agree to the terms of service and privacy policy',
		}),
		remember: z.boolean().optional(),
		redirectTo: z.string().optional(),
	})
	.and(PasswordAndConfirmPasswordSchema)

async function requireOnboardingPhoneNumber(request: Request) {
	await requireAnonymous(request)
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const phoneNumber = verifySession.get(onboardingPhoneNumberSessionKey)
	if (typeof phoneNumber !== 'string' || !phoneNumber) {
		throw redirect('/signup')
	}
	return phoneNumber
}

export async function loader({ request }: LoaderFunctionArgs) {
	const phoneNumber = await requireOnboardingPhoneNumber(request)
	return json({ phoneNumber })
}

export async function action({ request }: ActionFunctionArgs) {
	const phoneNumber = await requireOnboardingPhoneNumber(request)
	const formData = await request.formData()
	await checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: (intent) =>
			SignupFormSchema.superRefine(async (data, ctx) => {
				const existingUser = await prisma.user.findUnique({
					where: { username: data.username },
					select: { id: true },
				})
				if (existingUser) {
					ctx.addIssue({
						path: ['username'],
						code: z.ZodIssueCode.custom,
						message: 'A user already exists with this username',
					})
					return
				}
			}).transform(async (data) => {
				if (intent !== null) return { ...data, session: null }

				const session = await signup({ ...data, phoneNumber })
				return { ...data, session }
			}),
		async: true,
	})

	if (submission.status !== 'success' || !submission.value.session) {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { session, remember, redirectTo } = submission.value

	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	authSession.set(sessionKey, session.id)
	const verifySession = await verifySessionStorage.getSession()
	const headers = new Headers()
	headers.append(
		'set-cookie',
		await authSessionStorage.commitSession(authSession, {
			expires: remember ? session.expirationDate : undefined,
		}),
	)
	headers.append(
		'set-cookie',
		await verifySessionStorage.destroySession(verifySession),
	)

	return redirectWithToast(
		safeRedirect(redirectTo),
		{ title: 'Welcome', description: 'Thanks for signing up!' },
		{ headers },
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Setup GratiText Account' }]
}

export const handle = authPageHandle

export default function SignupRoute() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [searchParams] = useSearchParams()
	const redirectTo = searchParams.get('redirectTo')

	const [form, fields] = useForm({
		id: 'onboarding-form',
		constraint: getZodConstraint(SignupFormSchema),
		defaultValue: { redirectTo },
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: SignupFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<FormPage
			title="Stay Connected, Stay Grateful"
			description="Almost there! Finish creating your account"
		>
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-1 flex-col"
			>
				<HoneypotInputs />
				<div className="grid gap-x-4 md:grid-cols-2">
					<Field
						labelProps={{ htmlFor: fields.name.id, children: 'Name' }}
						inputProps={{
							...getInputProps(fields.name, { type: 'text' }),
							autoComplete: 'name',
							autoFocus: true,
						}}
						errors={fields.name.errors}
					/>
					<Field
						labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
						inputProps={{
							...getInputProps(fields.username, { type: 'text' }),
							autoComplete: 'username',
							className: 'lowercase',
						}}
						errors={fields.username.errors}
					/>
				</div>
				<PasswordField
					labelProps={{ htmlFor: fields.password.id, children: 'Password' }}
					inputProps={{
						...getInputProps(fields.password, { type: 'password' }),
						autoComplete: 'new-password',
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
				<div className="flex flex-col gap-4 pt-1">
					<CheckboxField
						labelProps={{
							htmlFor: fields.agreeToTermsOfServiceAndPrivacyPolicy.id,
							children:
								'Do you agree to our Terms of Service and Privacy Policy?',
						}}
						description={
							<>
								Read the{' '}
								<Link
									to="/tos"
									target="_blank"
									rel="noreferrer"
									className="text-foreground font-semibold underline underline-offset-4"
								>
									Terms of Service
								</Link>{' '}
								and{' '}
								<Link
									to="/privacy"
									target="_blank"
									rel="noreferrer"
									className="text-foreground font-semibold underline underline-offset-4"
								>
									Privacy Policy
								</Link>
								.
							</>
						}
						buttonProps={getInputProps(
							fields.agreeToTermsOfServiceAndPrivacyPolicy,
							{ type: 'checkbox' },
						)}
						errors={fields.agreeToTermsOfServiceAndPrivacyPolicy.errors}
					/>
					<CheckboxField
						labelProps={{
							htmlFor: fields.remember.id,
							children: 'Remember me',
						}}
						buttonProps={getInputProps(fields.remember, { type: 'checkbox' })}
						errors={fields.remember.errors}
					/>
				</div>
				<input {...getInputProps(fields.redirectTo, { type: 'hidden' })} />
				<ErrorList errors={form.errors} id={form.errorId} />
				<FormActions className="md:pt-6">
					<StatusButton
						variant="brand"
						size="lg"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						type="submit"
						disabled={isPending}
					>
						<Icon name="check" size="sm" aria-hidden="true" />
						Create an Account
					</StatusButton>
				</FormActions>
			</Form>
		</FormPage>
	)
}
