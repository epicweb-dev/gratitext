import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import {
	json,
	redirect,
	type ActionFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { sendText } from '#app/utils/text.server.js'
import {
	PhoneNumberSchema,
	UsernameSchema,
} from '#app/utils/user-validation.ts'
import { prepareVerification } from './verify.server.ts'

const ForgotPasswordSchema = z.object({
	usernameOrPhoneNumber: z.union([PhoneNumberSchema, UsernameSchema]),
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: ForgotPasswordSchema.superRefine(async (data, ctx) => {
			const user = await prisma.user.findFirst({
				where: {
					OR: [
						{ phoneNumber: data.usernameOrPhoneNumber },
						{ username: data.usernameOrPhoneNumber },
					],
				},
				select: { id: true },
			})
			if (!user) {
				ctx.addIssue({
					path: ['usernameOrPhoneNumber'],
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
	const { usernameOrPhoneNumber } = submission.value

	const user = await prisma.user.findFirstOrThrow({
		where: {
			OR: [
				{ phoneNumber: usernameOrPhoneNumber },
				{ username: usernameOrPhoneNumber },
			],
		},
		select: { phoneNumber: true, username: true },
	})

	const { verifyUrl, redirectTo, otp } = await prepareVerification({
		period: 10 * 60,
		request,
		type: 'reset-password',
		target: usernameOrPhoneNumber,
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
		lastResult: forgotPassword.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ForgotPasswordSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="container pb-32 pt-20">
			<div className="flex flex-col justify-center">
				<div className="text-center">
					<h1 className="text-h1">Forgot Password</h1>
					<p className="mt-3 text-body-md text-muted-foreground">
						No worries, we'll send you reset instructions.
					</p>
				</div>
				<div className="mx-auto mt-16 min-w-full max-w-sm sm:min-w-[368px]">
					<forgotPassword.Form method="POST" {...getFormProps(form)}>
						<HoneypotInputs />
						<div>
							<Field
								labelProps={{
									htmlFor: fields.usernameOrPhoneNumber.id,
									children: 'Username or Phone Number',
								}}
								inputProps={{
									autoFocus: true,
									...getInputProps(fields.usernameOrPhoneNumber, {
										type: 'text',
									}),
								}}
								errors={fields.usernameOrPhoneNumber.errors}
							/>
						</div>
						<ErrorList errors={form.errors} id={form.errorId} />

						<div className="mt-6">
							<StatusButton
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
						</div>
					</forgotPassword.Form>
					<Link
						to="/login"
						className="mt-11 text-center text-body-sm font-bold"
					>
						Back to Login
					</Link>
				</div>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
