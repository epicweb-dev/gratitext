import {
	getFormProps,
	getInputProps,
	getSelectProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SerializeFrom } from '@remix-run/node'
import { Form, useActionData, useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field, SelectField } from '#app/components/forms.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.js'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { validateCronString } from '#app/utils/cron.ts'
import { useDoubleCheck, useIsPending } from '#app/utils/misc.tsx'
import { type Recipient } from '#app/utils/prisma-generated.server/client.ts'
import {
	type deleteRecipientAction,
	type sendVerificationAction,
	type usertRecipientAction,
} from './__editor.server.tsx'

export const deleteRecipientActionIntent = 'delete-recipient'
export const upsertRecipientActionIntent = 'upsert-recipient'
export const sendVerificationActionIntent = 'send-verification'

export const RecipientEditorSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1).max(100),
	phoneNumber: z.string().min(1).max(100),
	scheduleCron: z
		.string()
		.min(1, 'Cron string is required')
		.refine(
			(cronString) => {
				const validation = validateCronString(cronString)
				return validation.valid
			},
			(cronString) => {
				const validation = validateCronString(cronString)
				return {
					message: validation.error || 'Invalid cron string',
				}
			},
		),
	timeZone: z.string(),
	disabled: z.coerce.boolean().optional().default(false),
})

export const DeleteRecipientSchema = z.object({
	intent: z.literal('delete-recipient'),
	recipientId: z.string(),
})

export function RecipientEditor({
	supportedTimeZones,
	recipient,
}: {
	supportedTimeZones: Array<string>
	recipient?: SerializeFrom<
		Pick<
			Recipient,
			'id' | 'name' | 'phoneNumber' | 'scheduleCron' | 'timeZone' | 'verified' | 'disabled'
		>
	>
}) {
	const actionData = useActionData<typeof usertRecipientAction>()
	const isPending = useIsPending()
	const needsVerification = recipient?.verified === false
	const pageTitle = recipient ? 'Edit Recipient' : 'Create Recipient'
	const pauseLabel = recipient?.disabled ? 'Resume this schedule' : 'Pause this schedule'

	const [form, fields] = useForm({
		id: 'recipient-editor',
		constraint: getZodConstraint(RecipientEditorSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: RecipientEditorSchema })
		},
		defaultValue: recipient ? { ...recipient, disabled: recipient.disabled ?? false } : undefined,
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex flex-col items-center gap-8">
			<div className="text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
					GratiText
				</p>
				<h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
					{pageTitle}
				</h1>
			</div>
			<div className="w-full max-w-3xl rounded-[32px] border border-border bg-card p-8 shadow-sm">
				<div className="flex justify-end gap-2">
					{needsVerification ? <VerifyForm /> : null}
				</div>
				{needsVerification ? (
					<div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground-destructive">
						<strong className="font-semibold">Verification required</strong>
						<p className="mt-2 text-muted-foreground">
							Click "Verify" to send a verification code to{' '}
							{recipient?.phoneNumber}. You will enter the code in the next step.
						</p>
					</div>
				) : null}
				<Form
					method="POST"
					className="mt-6 flex flex-col gap-6"
					{...getFormProps(form)}
				>
					{/*
						This hidden submit button is here to ensure that when the user hits
						"enter" on an input field, the primary form function is submitted
						rather than the first button in the form (which is delete/add image).
					*/}
					<button
						type="submit"
						className="hidden"
						name="intent"
						value={upsertRecipientActionIntent}
					/>
					{recipient ? (
						<input type="hidden" name="id" value={recipient.id} />
					) : null}
					<Field
						labelProps={{ children: 'Name' }}
						inputProps={{
							autoFocus: true,
							...getInputProps(fields.name, { type: 'text' }),
						}}
						errors={fields.name.errors}
					/>
					<div className="grid gap-4 md:grid-cols-2">
						<Field
							labelProps={{ children: 'Phone Number' }}
							inputProps={{
								...getInputProps(fields.phoneNumber, { type: 'tel' }),
							}}
							errors={fields.phoneNumber.errors}
						/>
						<SelectField
							labelProps={{ children: 'Time Zone' }}
							selectProps={{
								...getSelectProps(fields.timeZone),
								children: supportedTimeZones.map((tz) => (
									<option key={tz} value={tz}>
										{tz}
									</option>
								)),
							}}
							errors={fields.timeZone.errors}
						/>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-sm font-semibold text-foreground">
							Create a Schedule
						</p>
						<label className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground">
							<input
								{...getInputProps(fields.disabled, { type: 'checkbox' })}
								className="peer sr-only"
							/>
							<span className="peer-checked:text-foreground">{pauseLabel}</span>
						</label>
					</div>
					<Field
						labelProps={{ children: 'Schedule' }}
						inputProps={{
							...getInputProps(fields.scheduleCron, { type: 'text' }),
							placeholder: 'Every Thursday at 10:00 AM',
						}}
						errors={fields.scheduleCron.errors}
					/>
					<div className="flex items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
						<Icon name="info" size="sm" />
						<span>
							Your messages will arrive every week at this day and time.
						</span>
					</div>
					<small className="text-body-xs text-muted-foreground">
						Use{' '}
						<a
							href="https://crontab.guru/"
							className="underline"
							target="_blank"
							rel="noreferrer"
						>
							crontab.guru
						</a>{' '}
						to build a cron schedule.
					</small>
					<ErrorList id={form.errorId} errors={form.errors} />
				</Form>
				<div className="mt-8 flex flex-wrap items-center justify-between gap-3">
					{recipient?.id ? <DeleteRecipient id={recipient.id} /> : null}
					<div className="flex flex-wrap gap-3">
						<ButtonLink variant="secondary" to={recipient ? '..' : '/recipients'}>
							Cancel
						</ButtonLink>
						<StatusButton
							form={form.id}
							type="submit"
							disabled={isPending}
							status={isPending ? 'pending' : 'idle'}
							name="intent"
							value={upsertRecipientActionIntent}
							className="bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
						>
							<Icon name="check">Save Changes</Icon>
						</StatusButton>
					</div>
				</div>
			</div>
		</div>
	)
}

function VerifyForm() {
	const fetcher = useFetcher<typeof sendVerificationAction>()
	return (
		<fetcher.Form method="POST">
			<StatusButton
				type="submit"
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				name="intent"
				value={sendVerificationActionIntent}
			>
				<Icon name="check">Verify</Icon>
			</StatusButton>
		</fetcher.Form>
	)
}

function DeleteRecipient({ id }: { id: string }) {
	const fetcher = useFetcher<typeof deleteRecipientAction>()
	const isPending = useIsPending()
	const dc = useDoubleCheck({ safeDelayMs: 300 })
	const [form] = useForm({
		id: 'delete-recipient',
		lastResult: fetcher.data?.result,
	})

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="recipientId" value={id} />
			<StatusButton
				variant="destructive"
				status={isPending ? 'pending' : (form.status ?? 'idle')}
				{...dc.getButtonProps({
					type: 'submit',
					title: dc.doubleCheck ? 'Are you sure?' : 'Delete recipient',
					name: 'intent',
					value: deleteRecipientActionIntent,
					disabled: isPending,
					className: 'data-[safe-delay=true]:opacity-50',
				})}
			>
				{dc.doubleCheck ? (
					<Icon name="question-mark-circled">Confirm</Icon>
				) : (
					<Icon name="trash">Delete</Icon>
				)}
			</StatusButton>
			<ErrorList errors={form.errors} id={form.errorId} />
		</fetcher.Form>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No recipient with the id "{params.recipientId}" exists</p>
				),
			}}
		/>
	)
}
