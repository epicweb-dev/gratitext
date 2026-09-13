import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	Form,
	data as json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	useActionData,
	useLoaderData,
} from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { SettingsCard } from '#app/components/settings-card.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	prepareVerification,
	requireRecentVerification,
} from '#app/routes/_app+/_auth+/verify.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { sendText } from '#app/utils/text.server.js'
import { PhoneNumberSchema } from '#app/utils/user-validation.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { type BreadcrumbHandle } from './_layout.tsx'

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="device-phone-mobile-outline">Change Number</Icon>,
	getSitemapEntries: () => null,
}

export const newPhoneNumberSessionKey = 'new-phone-number'

const ChangeNumberSchema = z.object({
	phoneNumber: PhoneNumberSchema,
})

export async function loader({ request }: LoaderFunctionArgs) {
	await requireRecentVerification(request)
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { phoneNumber: true },
	})
	if (!user) {
		const params = new URLSearchParams({ redirectTo: request.url })
		throw redirect(`/login?${params}`)
	}
	return json({ user })
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = await parseWithZod(formData, {
		schema: ChangeNumberSchema.superRefine(async (data, ctx) => {
			const existingUser = await prisma.user.findUnique({
				where: { phoneNumber: data.phoneNumber },
			})
			if (existingUser) {
				ctx.addIssue({
					path: ['phoneNumber'],
					code: z.ZodIssueCode.custom,
					message: 'This phone number is already in use.',
				})
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
	const { otp, redirectTo, verifyUrl } = await prepareVerification({
		period: 10 * 60,
		request,
		target: userId,
		type: 'change-phone-number',
	})

	const response = await sendText({
		to: submission.value.phoneNumber,
		message: `GratiText Phone Number Change Verification\n\nHere's your verification code: ${otp}\n\nOr click here to verify: ${verifyUrl.toString()}`,
	})

	if (response.status === 'success') {
		const verifySession = await verifySessionStorage.getSession()
		verifySession.set(newPhoneNumberSessionKey, submission.value.phoneNumber)
		return redirect(redirectTo.toString(), {
			headers: {
				'set-cookie': await verifySessionStorage.commitSession(verifySession),
			},
		})
	} else {
		return json(
			{ result: submission.reply({ formErrors: [response.error] }) },
			{ status: 500 },
		)
	}
}

export default function ChangePhoneNumberIndex() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	const [form, fields] = useForm({
		id: 'change-phone-number-form',
		constraint: getZodConstraint(ChangeNumberSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ChangeNumberSchema })
		},
	})

	const isPending = useIsPending()
	return (
		<SettingsCard
			title="Change your phone number"
			description={
				<>
					<p>
						We will text a confirmation code to the new number. Your current
						number,{' '}
						<strong className="text-foreground">{data.user.phoneNumber}</strong>
						, will also get a heads-up that the change happened.
					</p>
				</>
			}
		>
			<Form method="POST" {...getFormProps(form)} className="space-y-6">
				<Field
					labelProps={{ children: 'New Phone Number' }}
					inputProps={{
						...getInputProps(fields.phoneNumber, { type: 'tel' }),
						autoComplete: 'tel',
						placeholder: '+1 555 123 4567',
					}}
					errors={fields.phoneNumber.errors}
				/>
				<ErrorList id={form.errorId} errors={form.errors} />
				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<ButtonLink variant="secondary" to="..">
						Cancel
					</ButtonLink>
					<StatusButton
						variant="brand"
						status={isPending ? 'pending' : (form.status ?? 'idle')}
					>
						Send Confirmation
					</StatusButton>
				</div>
			</Form>
		</SettingsCard>
	)
}
