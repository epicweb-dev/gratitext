import {
	getFormProps,
	getInputProps,
	getSelectProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { useState } from 'react'
import { Form, useActionData, useFetcher } from 'react-router'
import { z } from 'zod'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.tsx'
import { FormActions, FormPage } from '#app/components/form-page.tsx'
import {
	ErrorList,
	Field,
	SelectField,
	selectClassName,
	SelectChevron,
} from '#app/components/forms.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.js'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	countryCodeLabel,
	countryCodes,
	OTHER_COUNTRY_CODE,
	splitPhoneNumber,
} from '#app/utils/country-codes.ts'
import { validateCronString } from '#app/utils/cron.ts'
import { cn, useDoubleCheck, useIsPending } from '#app/utils/misc.tsx'
import { type Recipient } from '#app/utils/prisma-generated.server/client.ts'
import { type TimeZoneOption } from '#app/utils/time-zones.server.ts'
import {
	buildWeeklyCron,
	parseWeeklyCron,
	timeOptions,
	weekdays,
	type WeekdayValue,
} from '#app/utils/weekly-schedule.ts'
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
	name: z.string({ error: 'Please, fill in a name' }).min(1).max(100),
	countryCode: z.string({ error: 'Country code is required' }).min(1),
	phoneNumber: z
		.string({ error: 'Please, fill in the phone number' })
		.min(1)
		.max(100),
	scheduleCron: z
		.string({ error: 'Please, select a day and time' })
		.min(1)
		.superRefine((cronString, ctx) => {
			const validation = validateCronString(cronString)
			if (!validation.valid) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: validation.error || 'Invalid cron string',
				})
			}
		}),
	timeZone: z.string({ error: 'Please, select a time zone' }).min(1),
	disabled: z.coerce.boolean().optional().default(false),
})

export const DeleteRecipientSchema = z.object({
	intent: z.literal('delete-recipient'),
	recipientId: z.string(),
})

export type ReservedDays = Partial<Record<WeekdayValue, string>>

export function RecipientEditor({
	timeZones,
	recipient,
	reservedDays = {},
}: {
	timeZones: Array<TimeZoneOption>
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
	/** Weekdays already taken by other recipients on a one-message-a-day plan. */
	reservedDays?: ReservedDays
}) {
	const actionData = useActionData<typeof usertRecipientAction>()
	const isPending = useIsPending()
	const needsVerification = recipient?.verified === false
	const [isDisabled, setIsDisabled] = useState(recipient?.disabled ?? false)
	const defaultTimeZone =
		recipient?.timeZone ??
		(timeZones.some((tz) => tz.value === 'America/New_York')
			? 'America/New_York'
			: timeZones[0]?.value) ??
		'UTC'
	const existingWeekly = recipient
		? parseWeeklyCron(recipient.scheduleCron)
		: null
	const [mode, setMode] = useState<'weekly' | 'custom'>(
		recipient && !existingWeekly ? 'custom' : 'weekly',
	)
	const [day, setDay] = useState<WeekdayValue | ''>(existingWeekly?.day ?? '')
	const [time, setTime] = useState(existingWeekly?.time ?? '')
	const [customCron, setCustomCron] = useState(
		existingWeekly ? '' : (recipient?.scheduleCron ?? ''),
	)
	const cronValue =
		mode === 'weekly'
			? day && time
				? buildWeeklyCron({ day, time })
				: ''
			: customCron
	const phoneParts = recipient ? splitPhoneNumber(recipient.phoneNumber) : null

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
					countryCode: phoneParts?.countryCode,
					phoneNumber: phoneParts?.national,
					scheduleCron: recipient.scheduleCron,
					timeZone: recipient.timeZone,
					disabled: recipient.disabled ? 'on' : undefined,
				}
			: { countryCode: countryCodes[0]?.value, timeZone: defaultTimeZone },
		shouldRevalidate: 'onBlur',
	})

	const disabledInputProps = getInputProps(fields.disabled, {
		type: 'checkbox',
	})
	const scheduleErrors = fields.scheduleCron.errors
	const scheduleErrorId = scheduleErrors?.length
		? fields.scheduleCron.errorId
		: undefined
	const pauseLabel = isDisabled ? 'Resume this Schedule' : 'Pause this Schedule'

	return (
		<FormPage
			as="div"
			title={recipient ? 'Edit Recipient' : 'Add New Recipient'}
			description={
				recipient
					? undefined
					: 'Tell us who should hear from you and when your notes should arrive'
			}
		>
			{needsVerification ? (
				<div className="border-warning/60 bg-warning/10 text-foreground mb-6 flex flex-col gap-3 rounded-2xl border p-4 text-sm md:flex-row md:items-center md:justify-between">
					<div className="flex items-start gap-3">
						<Icon
							name="exclamation-circle-outline"
							size="md"
							aria-hidden="true"
							className="text-warning mt-0.5 shrink-0"
						/>
						<div>
							<p className="font-semibold">Verification required</p>
							<p className="text-muted-foreground mt-1">
								Messages won't be sent until {recipient?.name} confirms their
								number. Press <strong>Verify</strong> to text a code to{' '}
								{recipient?.phoneNumber}, then enter the code they share with
								you.
							</p>
						</div>
					</div>
					<VerifyForm />
				</div>
			) : null}
			<Form method="POST" className="flex flex-col" {...getFormProps(form)}>
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
						placeholder: "Recipient's Name",
						...getInputProps(fields.name, { type: 'text' }),
					}}
					errors={fields.name.errors}
				/>
				<div className="grid gap-x-4 md:grid-cols-2">
					<SelectField
						labelProps={{ children: 'Country Code' }}
						selectProps={{
							...getSelectProps(fields.countryCode),
							children: (
								<>
									{countryCodes.map((code) => (
										<option key={code.value} value={code.value}>
											{countryCodeLabel(code)}
										</option>
									))}
									<option value={OTHER_COUNTRY_CODE}>
										Other (type the full number)
									</option>
								</>
							),
						}}
						errors={fields.countryCode.errors}
					/>
					<Field
						labelProps={{ children: 'Phone Number' }}
						inputProps={{
							placeholder: '123 456 7890',
							autoComplete: 'off',
							...getInputProps(fields.phoneNumber, { type: 'tel' }),
						}}
						errors={fields.phoneNumber.errors}
					/>
				</div>
				<SelectField
					labelProps={{ children: 'Time Zone' }}
					selectProps={{
						...getSelectProps(fields.timeZone),
						children: timeZones.map((tz) => (
							<option key={tz.value} value={tz.value}>
								{tz.label}
							</option>
						)),
					}}
					errors={fields.timeZone.errors}
				/>

				<fieldset>
					<div className="flex items-center justify-between gap-4">
						<legend className="text-foreground text-sm leading-none font-medium">
							Create a Schedule
						</legend>
						{recipient ? (
							<label
								className={cn(
									'has-[:focus-visible]:ring-ring relative inline-flex h-7 cursor-pointer items-center gap-2 rounded-full px-3 text-[0.6875rem] font-semibold transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2',
									isDisabled
										? 'bg-brand-muted text-brand-muted-foreground'
										: 'bg-destructive/15 text-foreground-destructive',
								)}
							>
								<input
									{...disabledInputProps}
									className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
									onChange={(e) => setIsDisabled(e.target.checked)}
								/>
								{pauseLabel}
							</label>
						) : null}
					</div>
					<input
						type="hidden"
						name={fields.scheduleCron.name}
						value={cronValue}
					/>
					{mode === 'weekly' ? (
						<div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
							<div className="relative">
								<label htmlFor="schedule-day" className="sr-only">
									Day
								</label>
								<select
									id="schedule-day"
									value={day}
									aria-invalid={scheduleErrorId ? true : undefined}
									aria-describedby={scheduleErrorId}
									onChange={(event) =>
										setDay(event.currentTarget.value as WeekdayValue | '')
									}
									className={cn(
										selectClassName,
										!day && 'text-subtle-foreground',
									)}
								>
									<option value="" disabled>
										Select Day
									</option>
									{weekdays.map((weekday) => {
										const reservedFor = reservedDays[weekday.value]
										return (
											<option
												key={weekday.value}
												value={weekday.value}
												disabled={Boolean(reservedFor)}
											>
												Every {weekday.label}
												{reservedFor ? ` — Reserved for ${reservedFor}` : ''}
											</option>
										)
									})}
								</select>
								<SelectChevron />
							</div>
							<div className="relative">
								<label htmlFor="schedule-time" className="sr-only">
									Time
								</label>
								<select
									id="schedule-time"
									value={time}
									aria-invalid={scheduleErrorId ? true : undefined}
									aria-describedby={scheduleErrorId}
									onChange={(event) => setTime(event.currentTarget.value)}
									className={cn(
										selectClassName,
										!time && 'text-subtle-foreground',
									)}
								>
									<option value="" disabled>
										Select Time
									</option>
									{timeOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								<SelectChevron />
							</div>
						</div>
					) : (
						<div className="mt-3">
							<label htmlFor="schedule-cron" className="sr-only">
								Cron expression
							</label>
							<input
								id="schedule-cron"
								type="text"
								value={customCron}
								placeholder="0 9 * * 1"
								spellCheck={false}
								autoComplete="off"
								aria-invalid={scheduleErrorId ? true : undefined}
								aria-describedby={scheduleErrorId}
								onChange={(event) => setCustomCron(event.currentTarget.value)}
								className={cn(
									selectClassName,
									'appearance-auto pr-5 font-mono',
								)}
							/>
						</div>
					)}
					<div className="min-h-6 px-1 pt-1.5 text-right">
						{scheduleErrorId ? (
							<ErrorList id={scheduleErrorId} errors={scheduleErrors} />
						) : null}
					</div>
					<div className="text-foreground flex items-start gap-3 text-sm">
						<Icon
							name="info"
							size="sm"
							aria-hidden="true"
							className="text-muted-foreground mt-0.5 shrink-0"
						/>
						<div>
							<p>
								{isDisabled
									? 'Schedule for this recipient is currently paused. Resume the schedule in order to share your weekly gratitude with them.'
									: mode === 'weekly'
										? 'Your messages will arrive every week at this day and time'
										: 'Cron expressions run in the recipient’s time zone.'}
							</p>
							<button
								type="button"
								onClick={() => setMode(mode === 'weekly' ? 'custom' : 'weekly')}
								className="text-muted-foreground hover:text-foreground mt-1 text-xs underline-offset-4 hover:underline"
							>
								{mode === 'weekly'
									? 'Need something else? Use a cron expression instead.'
									: 'Switch back to a weekly schedule.'}
							</button>
						</div>
					</div>
				</fieldset>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<FormActions
				className="md:pt-8"
				aside={recipient?.id ? <DeleteRecipient id={recipient.id} /> : null}
			>
				<ButtonLink
					variant="outline"
					size="lg"
					to={recipient ? `/recipients/${recipient.id}` : '/recipients'}
				>
					Cancel
				</ButtonLink>
				<StatusButton
					form={form.id}
					type="submit"
					size="lg"
					disabled={isPending}
					status={isPending ? 'pending' : 'idle'}
					name="intent"
					value={upsertRecipientActionIntent}
					variant="brand"
				>
					{recipient ? (
						<>
							Save Changes
							<Icon name="check" size="sm" aria-hidden="true" />
						</>
					) : (
						<>
							<Icon name="check" size="sm" aria-hidden="true" />
							Add New Recipient
						</>
					)}
				</StatusButton>
			</FormActions>
		</FormPage>
	)
}

function VerifyForm() {
	const fetcher = useFetcher<typeof sendVerificationAction>()
	return (
		<fetcher.Form method="POST" className="shrink-0">
			<StatusButton
				type="submit"
				variant="warm"
				size="sm"
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				name="intent"
				value={sendVerificationActionIntent}
			>
				<Icon name="send" size="xs" aria-hidden="true" />
				Verify
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
				variant={dc.doubleCheck ? 'destructive' : 'link'}
				size="lg"
				status={isPending ? 'pending' : (form.status ?? 'idle')}
				{...dc.getButtonProps({
					type: 'submit',
					title: dc.doubleCheck ? 'Are you sure?' : 'Delete recipient',
					name: 'intent',
					value: deleteRecipientActionIntent,
					disabled: isPending,
					className: cn(
						'px-0 font-normal data-[safe-delay=true]:opacity-50',
						!dc.doubleCheck && 'text-muted-foreground hover:text-foreground',
					),
				})}
			>
				{dc.doubleCheck ? 'Confirm delete' : 'Delete Recipient'}
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
