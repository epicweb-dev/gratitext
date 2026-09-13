import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	Form,
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	useActionData,
} from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
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
import { type BreadcrumbHandle } from './_layout.tsx'

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="password">Password</Icon>,
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
		<SettingsCard
			title="Change your password"
			description="Choose something long and unique. You will stay signed in on this device."
		>
			<Form method="POST" {...getFormProps(form)}>
				<div className="space-y-6">
					<Field
						labelProps={{ children: 'Current Password' }}
						inputProps={{
							...getInputProps(fields.currentPassword, { type: 'password' }),
							autoComplete: 'current-password',
						}}
						errors={fields.currentPassword.errors}
					/>
					<Field
						labelProps={{ children: 'New Password' }}
						inputProps={{
							...getInputProps(fields.newPassword, { type: 'password' }),
							autoComplete: 'new-password',
						}}
						errors={fields.newPassword.errors}
					/>
					<Field
						labelProps={{ children: 'Confirm New Password' }}
						inputProps={{
							...getInputProps(fields.confirmNewPassword, {
								type: 'password',
							}),
							autoComplete: 'new-password',
						}}
						errors={fields.confirmNewPassword.errors}
					/>
					<ErrorList id={form.errorId} errors={form.errors} />
					<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
						<ButtonLink variant="secondary" to="..">
							Cancel
						</ButtonLink>
						<StatusButton
							type="submit"
							status={isPending ? 'pending' : (form.status ?? 'idle')}
							variant="brand"
						>
							Save password
						</StatusButton>
					</div>
				</div>
			</Form>
		</SettingsCard>
	)
}
