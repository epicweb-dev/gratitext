import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	Form,
	data as json,
	Link,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	useActionData,
} from 'react-router'
import { z } from 'zod'
import { FormActions } from '#app/components/form-page.tsx'
import { ErrorList, PasswordField } from '#app/components/forms.tsx'
import { SettingsCard } from '#app/components/settings-card.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	getPasswordHash,
	requireUserId,
	verifyUserPassword,
} from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { PasswordSchema } from '#app/utils/user-validation.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const ChangePasswordForm = z
	.object({
		currentPassword: PasswordSchema,
		newPassword: PasswordSchema,
		confirmNewPassword: PasswordSchema,
	})
	.superRefine(({ confirmNewPassword, newPassword }, ctx) => {
		if (confirmNewPassword !== newPassword) {
			ctx.addIssue({
				path: ['confirmNewPassword'],
				code: z.ZodIssueCode.custom,
				message: 'The passwords must match',
			})
		}
	})

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({})
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await request.formData()
	const submission = await parseWithZod(formData, {
		async: true,
		schema: ChangePasswordForm.superRefine(
			async ({ currentPassword, newPassword }, ctx) => {
				if (currentPassword && newPassword) {
					const user = await verifyUserPassword({ id: userId }, currentPassword)
					if (!user) {
						ctx.addIssue({
							path: ['currentPassword'],
							code: z.ZodIssueCode.custom,
							message: 'Incorrect password.',
						})
					}
				}
			},
		),
	})
	if (submission.status !== 'success') {
		return json(
			{
				result: submission.reply({
					hideFields: ['currentPassword', 'newPassword', 'confirmNewPassword'],
				}),
			},
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { newPassword } = submission.value

	await prisma.user.update({
		select: { username: true },
		where: { id: userId },
		data: {
			password: {
				update: {
					hash: await getPasswordHash(newPassword),
				},
			},
		},
	})

	return redirectWithToast(
		`/settings/profile`,
		{
			type: 'success',
			title: 'Password Changed',
			description: 'Your password has been changed.',
		},
		{ status: 302 },
	)
}

export default function ChangePasswordRoute() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'password-change-form',
		constraint: getZodConstraint(ChangePasswordForm),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ChangePasswordForm })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<SettingsCard title="Change Your Password" hideClose>
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-1 flex-col"
			>
				<PasswordField
					labelProps={{ children: 'Current Password' }}
					inputProps={{
						...getInputProps(fields.currentPassword, { type: 'password' }),
						autoComplete: 'current-password',
						autoFocus: true,
						placeholder: 'Enter Your Current Password',
					}}
					errors={fields.currentPassword.errors}
				/>
				<PasswordField
					labelProps={{ children: 'New Password' }}
					inputProps={{
						...getInputProps(fields.newPassword, { type: 'password' }),
						autoComplete: 'new-password',
						placeholder: 'Enter Your New Password',
					}}
					errors={fields.newPassword.errors}
				/>
				<PasswordField
					labelProps={{ children: 'Confirm New Password' }}
					inputProps={{
						...getInputProps(fields.confirmNewPassword, {
							type: 'password',
						}),
						autoComplete: 'new-password',
						placeholder: 'Confirm Your New Password',
					}}
					errors={fields.confirmNewPassword.errors}
				/>
				<ErrorList id={form.errorId} errors={form.errors} />
				<FormActions
					aside={<Link to="/forgot-password">Forgot Password?</Link>}
				>
					{/* Phones already have the "go back" link at the top of the page. */}
					<span className="hidden md:contents">
						<ButtonLink variant="outline" size="lg" to="/settings/profile">
							Cancel
						</ButtonLink>
					</span>
					<StatusButton
						type="submit"
						size="lg"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
						variant="brand"
						disabled={isPending}
						className="gap-2"
					>
						<Icon name="check" size="sm" aria-hidden="true" />
						Save
					</StatusButton>
				</FormActions>
			</Form>
		</SettingsCard>
	)
}
