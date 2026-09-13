import {
	getFormProps,
	getInputProps,
	getSelectProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { CronExpressionParser } from 'cron-parser'
import { useRef, useState } from 'react'
import { Form, useActionData, useFetcher } from 'react-router'
import { z } from 'zod'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.tsx'
import { ErrorList, Field, SelectField } from '#app/components/forms.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.js'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { validateCronString } from '#app/utils/cron.ts'
import { cn, useDoubleCheck, useIsPending } from '#app/utils/misc.tsx'
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
		.superRefine((cronString, ctx) => {
			const validation = validateCronString(cronString)
			if (!validation.valid) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: validation.error || 'Invalid cron string',
				})
			}
		}),
	timeZone: z.string(),
	disabled: z.coerce.boolean().optional().default(false),
})

export const DeleteRecipientSchema = z.object({
	intent: z.literal('delete-recipient'),
	recipientId: z.string(),
})

const schedulePresets = [
	{ label: 'Every day at 9:00 AM', cron: '0 9 * * *' },
	{ label: 'Weekdays at 8:00 AM', cron: '0 8 * * 1-5' },
	{ label: 'Mondays at 9:00 AM', cron: '0 9 * * 1' },
	{ label: 'Sundays at 6:00 PM', cron: '0 18 * * 0' },
	{ label: '1st of the month at 10:00 AM', cron: '0 10 1 * *' },
]

function describeNextSend(cron: string, timeZone: string) {
	if (!cron.trim()) return null
	try {
		const next = CronExpressionParser.parse(cron, { tz: timeZone })
			.next()
			.toDate()
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
			timeZone,
			timeZoneName: 'short',
		}).format(next)
	} catch {
		return null
	}
}

export function RecipientEditor({
	supportedTimeZones,
	recipient,
}: {
	supportedTimeZones: Array<string>
	recipient?: Pick<
		Recipient,
		| 'id'
		| 'name'
		| 'phoneNumber'
		| 'scheduleCron'
		| 'timeZone'
		| 'verified'
		| 'disabled'
	>
}) {
	const actionData = useActionData<typeof usertRecipientAction>()
	const isPending = useIsPending()
	const needsVerification = recipient?.verified === false
	const pageTitle = recipient ? 'Edit recipient' : 'Add a recipient'
	const pageDescription = recipient
		? 'Update their details or adjust when your notes arrive.'
		: 'Tell us who you want to reach and when your notes should arrive.'
	const [isDisabled, setIsDisabled] = useState(recipient?.disabled ?? false)
	const pauseLabel = isDisabled ? 'Resume this schedule' : 'Pause this schedule'
	const submitLabel = recipient ? 'Save Changes' : 'Add Recipient'
	const defaultTimeZone =
		recipient?.timeZone ??
		(supportedTimeZones.includes('America/New_York')
			? 'America/New_York'
			: supportedTimeZones[0]) ??
		'UTC'
	const [cronValue, setCronValue] = useState(recipient?.scheduleCron ?? '')
	const [timeZoneValue, setTimeZoneValue] = useState(defaultTimeZone)
	const cronInputRef = useRef<HTMLInputElement>(null)
	const nextSendPreview = describeNextSend(cronValue, timeZoneValue)

	const [form, fields] = useForm({
		id: 'recipient-editor',
		constraint: getZodConstraint(RecipientEditorSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: RecipientEditorSchema })
		},
		defaultValue: recipient
			? {
					id: recipient.id,
					name: recipient.name,
					phoneNumber: recipient.phoneNumber,
					scheduleCron: recipient.scheduleCron,
					timeZone: recipient.timeZone,
					disabled: recipient.disabled ? 'on' : undefined,
				}
			: { timeZone: defaultTimeZone },
		shouldRevalidate: 'onBlur',
	})

	const applyPreset = (cron: string) => {
		const input = cronInputRef.current
		if (!input) return
		input.value = cron
		input.dispatchEvent(new Event('input', { bubbles: true }))
		setCronValue(cron)
		input.focus()
	}

	const disabledInputProps = getInputProps(fields.disabled, {
		type: 'checkbox',
	})

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					{recipient ? (
						<h2 className="text-foreground text-2xl font-bold">{pageTitle}</h2>
					) : (
						<h1 className="text-foreground font-serif text-3xl font-semibold sm:text-4xl">
							{pageTitle}
						</h1>
					)}
					<p className="text-muted-foreground mt-1 text-sm">
						{pageDescription}
					</p>
				</div>
				{needsVerification ? <VerifyForm /> : null}
			</div>
			{needsVerification ? (
				<div className="border-warning/50 bg-warning/10 text-foreground flex items-start gap-3 rounded-2xl border p-4 text-sm">
					<Icon
						name="exclamation-circle-outline"
						size="md"
						aria-hidden="true"
						className="text-warning-foreground mt-0.5 shrink-0"
					/>
					<div>
						<p className="font-semibold">Verification required</p>
						<p className="text-muted-foreground mt-1">
							Messages won't be sent until {recipient?.name} confirms their
							number. Press <strong>Verify</strong> to text a code to{' '}
							{recipient?.phoneNumber}, then enter the code they share with you.
						</p>
					</div>
				</div>
			) : null}
			<Form
				method="POST"
				className="flex flex-col gap-2"
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
						placeholder: 'Grandma June',
						...getInputProps(fields.name, { type: 'text' }),
					}}
					errors={fields.name.errors}
				/>
				<div className="grid gap-x-4 sm:grid-cols-2">
					<Field
						labelProps={{ children: 'Phone Number' }}
						inputProps={{
							placeholder: '+1 555 123 4567',
							autoComplete: 'off',
							...getInputProps(fields.phoneNumber, { type: 'tel' }),
						}}
						errors={fields.phoneNumber.errors}
					/>
					<SelectField
						labelProps={{ children: 'Their Time Zone' }}
						selectProps={{
							...getSelectProps(fields.timeZone),
							onChange: (event) => setTimeZoneValue(event.currentTarget.value),
							children: supportedTimeZones.map((tz) => (
								<option key={tz} value={tz}>
									{tz.replaceAll('_', ' ')}
								</option>
							)),
						}}
						errors={fields.timeZone.errors}
					/>
				</div>

				<fieldset className="border-border bg-muted/40 mt-2 rounded-[24px] border p-4 sm:p-5">
					<legend className="text-foreground px-1 text-sm font-semibold">
						Schedule
					</legend>
					<p className="text-muted-foreground -mt-1 mb-4 text-sm">
						Pick a preset or write your own. Times are in their time zone.
					</p>
					<div className="mb-4 flex flex-wrap gap-2">
						{schedulePresets.map((preset) => {
							const selected = preset.cron === cronValue.trim()
							return (
								<button
									key={preset.cron}
									type="button"
									onClick={() => applyPreset(preset.cron)}
									aria-pressed={selected}
									className={cn(
										'focus-visible:ring-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
										selected
											? 'border-brand bg-brand text-brand-foreground'
											: 'border-border bg-card text-foreground hover:border-brand/60',
									)}
								>
									{preset.label}
								</button>
							)
						})}
					</div>
					<Field
						labelProps={{ children: 'Cron expression' }}
						inputProps={{
							placeholder: '0 9 * * 1',
							...getInputProps(fields.scheduleCron, { type: 'text' }),
							ref: cronInputRef,
							onChange: (event) => setCronValue(event.currentTarget.value),
							className: 'font-mono',
							spellCheck: false,
							autoComplete: 'off',
						}}
						errors={fields.scheduleCron.errors}
					/>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-muted-foreground flex items-center gap-2 text-sm">
							<Icon name="clock" size="sm" aria-hidden="true" />
							{nextSendPreview ? (
								<span>
									Next send:{' '}
									<span className="text-foreground font-semibold">
										{nextSendPreview}
									</span>
								</span>
							) : (
								<span>
									Enter a valid schedule to preview the next send. Need help?{' '}
									<a
										href="https://crontab.guru/"
										className="text-foreground font-semibold underline underline-offset-4"
										target="_blank"
										rel="noreferrer"
									>
										crontab.guru
									</a>
								</span>
							)}
						</p>
						<label className="border-border bg-card hover:border-brand/60 has-[:checked]:border-warning has-[:checked]:bg-warning/10 inline-flex cursor-pointer items-center gap-2.5 self-start rounded-full border px-3 py-2 text-sm font-semibold transition-colors">
							<input
								{...disabledInputProps}
								className="accent-warning h-4 w-4 rounded"
								onChange={(e) => setIsDisabled(e.target.checked)}
							/>
							<span>{pauseLabel}</span>
						</label>
					</div>
				</fieldset>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className="border-border flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
				{recipient?.id ? <DeleteRecipient id={recipient.id} /> : <span />}
				<div className="flex flex-col-reverse gap-3 sm:flex-row">
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
						variant="brand"
					>
						<Icon name="check">{submitLabel}</Icon>
					</StatusButton>
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
				variant="warm"
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				name="intent"
				value={sendVerificationActionIntent}
			>
				<Icon name="send">Verify</Icon>
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
				variant={dc.doubleCheck ? 'destructive' : 'ghost'}
				status={isPending ? 'pending' : (form.status ?? 'idle')}
				{...dc.getButtonProps({
					type: 'submit',
					title: dc.doubleCheck ? 'Are you sure?' : 'Delete recipient',
					name: 'intent',
					value: deleteRecipientActionIntent,
					disabled: isPending,
					className: cn(
						'data-[safe-delay=true]:opacity-50',
						!dc.doubleCheck &&
							'text-foreground-destructive hover:bg-destructive/10',
					),
				})}
			>
				{dc.doubleCheck ? (
					<Icon name="question-mark-circled">Confirm delete</Icon>
				) : (
					<Icon name="trash">Delete recipient</Icon>
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
					<ErrorMessage
						eyebrow="Error 404"
						title="Recipient not found"
						description={`No recipient with the id "${params.recipientId}" exists.`}
					/>
				),
			}}
		/>
	)
}
