import {
	getFormProps,
	getInputProps,
	getSelectProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type Recipient } from '@prisma/client'
import { type SerializeFrom } from '@remix-run/node'
import { Form, useActionData, useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList, Field, SelectField } from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.js'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { useDoubleCheck, useIsPending } from '#app/utils/misc.tsx'
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
	scheduleCron: z.string(),
	timeZone: z.string(),
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
			'id' | 'name' | 'phoneNumber' | 'scheduleCron' | 'timeZone' | 'verified'
		>
	>
}) {
	const actionData = useActionData<typeof usertRecipientAction>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'recipient-editor',
		constraint: getZodConstraint(RecipientEditorSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: RecipientEditorSchema })
		},
		defaultValue: recipient,
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="absolute inset-0">
			<div className="flex justify-end gap-2 p-6">
				{recipient && !recipient.verified ? <VerifyForm /> : null}
				{recipient?.id ? <DeleteRecipient id={recipient.id} /> : null}
			</div>
			<Form
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
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
				<div className="flex flex-col gap-1">
					<Field
						labelProps={{ children: 'Name' }}
						inputProps={{
							autoFocus: true,
							...getInputProps(fields.name, { type: 'text' }),
						}}
						errors={fields.name.errors}
					/>
					<Field
						labelProps={{ children: 'Number' }}
						inputProps={{
							...getInputProps(fields.phoneNumber, { type: 'tel' }),
						}}
						errors={fields.phoneNumber.errors}
					/>
					<small className="text-body-xs">
						The UX for this will be improved later, but for now you can use{' '}
						<a
							href="https://crontab.guru/"
							className="underline"
							target="_blank"
							rel="noreferrer"
						>
							crontab.guru
						</a>{' '}
						to create a cron schedule
					</small>
					<Field
						labelProps={{ children: 'Schedule Cron' }}
						inputProps={{
							...getInputProps(fields.scheduleCron, { type: 'text' }),
						}}
						errors={fields.scheduleCron.errors}
					/>
					<SelectField
						labelProps={{ children: 'Time Zone' }}
						selectProps={{
							...getSelectProps(fields.timeZone),
							children: supportedTimeZones.map(tz => (
								<option key={tz} value={tz}>
									{tz}
								</option>
							)),
						}}
						errors={fields.timeZone.errors}
					/>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<StatusButton
					form={form.id}
					type="submit"
					disabled={isPending}
					status={isPending ? 'pending' : 'idle'}
					name="intent"
					value={upsertRecipientActionIntent}
				>
					Submit
				</StatusButton>
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
				status={isPending ? 'pending' : form.status ?? 'idle'}
				{...dc.getButtonProps({
					type: 'submit',
					title: dc.doubleCheck ? 'Are you sure?' : 'Delete recipient',
					name: 'intent',
					value: deleteRecipientActionIntent,
					disabled: isPending,
					className:
						'w-full max-md:aspect-square max-md:px-0 data-[safe-delay=true]:opacity-50',
				})}
			>
				{dc.doubleCheck ? (
					<Icon
						name="question-mark-circled"
						className="scale-125 max-md:scale-150"
					>
						<span className="max-md:hidden">Confirm</span>
					</Icon>
				) : (
					<Icon name="trash" className="scale-125 max-md:scale-150">
						<span className="max-md:hidden">Delete</span>
					</Icon>
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
