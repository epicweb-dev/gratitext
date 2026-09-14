import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { useEffect, useRef } from 'react'
import {
	Link,
	useFetcher,
	useOutletContext,
	useSearchParams,
} from 'react-router'
import {
	ErrorList,
	FieldErrorSlot,
	SelectChevron,
	selectClassName,
} from '#app/components/forms.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon, type IconName } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	countryCodeLabel,
	countryCodes,
	OTHER_COUNTRY_CODE,
	splitPhoneNumber,
} from '#app/utils/country-codes.ts'
import { cn, useDoubleCheck } from '#app/utils/misc.tsx'
import {
	ChangeNumberSchema,
	deleteDataActionIntent,
	signOutOfSessionsActionIntent,
	UpdateNameSchema,
	updateNameActionIntent,
} from './__schemas.ts'
import { type SettingsOutletContext } from './_layout.tsx'
import { type action as changeNumberRouteAction } from './change-number.tsx'
import { type action as overviewRouteAction } from './index.tsx'

const overviewPath = '/settings/profile'
// Index routes need `?index`, otherwise the submission targets the layout.
const overviewAction = `${overviewPath}?index`
const changeNumberAction = '/settings/profile/change-number'

/** Which inline editor the `?edit=` search param has opened, if any. */
export type EditMode = 'name' | 'phone' | null

export function useEditMode(): EditMode {
	const [searchParams] = useSearchParams()
	const edit = searchParams.get('edit')
	return edit === 'name' || edit === 'phone' ? edit : null
}

const readOnlyFieldClassName =
	'read-only:border-transparent read-only:bg-surface read-only:text-muted-foreground md:read-only:bg-muted'

/**
 * The account settings page body. Sub-routes such as the password dialog
 * render it underneath their modal on desktop, hence `inert`.
 */
export function SettingsOverview({
	inert = false,
	className,
}: {
	inert?: boolean
	className?: string
}) {
	const { user, isTwoFactorEnabled } = useOutletContext<SettingsOutletContext>()
	const activeEditMode = useEditMode()
	const editMode = inert ? null : activeEditMode
	const greetingName = user.name?.trim() || user.username

	const settingsLinks: Array<{
		to: string
		icon: IconName
		title: string
		reloadDocument?: boolean
		download?: string
	}> = [
		{
			to: `${overviewPath}/subscription`,
			icon: 'banknotes-outline',
			title: 'Manage Your Subscriptions',
		},
		{
			to: `${overviewPath}/password`,
			icon: 'password',
			title: 'Change Password',
		},
		{
			to: `${overviewPath}/two-factor`,
			icon: isTwoFactorEnabled ? 'lock-closed' : 'lock-open-1',
			title: isTwoFactorEnabled ? 'Manage 2FA' : 'Enable 2FA',
		},
		{
			to: '/resources/download-user-data',
			icon: 'download',
			title: 'Download Your Data',
			reloadDocument: true,
			download: 'my-gratitext-data.json',
		},
	]

	return (
		<div
			inert={inert}
			className={cn(
				'container flex flex-1 flex-col pt-8 pb-12 md:max-w-[52rem] md:pt-14 md:pb-24',
				className,
			)}
		>
			<h1 className="font-display text-foreground md:text-h2 text-center text-[2rem] leading-none">
				Hi {greetingName}!
			</h1>

			<section
				aria-label="Your details"
				className="md:bg-surface md:text-surface-foreground mt-9 flex flex-col gap-6 md:mt-12 md:rounded-[1.5rem] md:px-9 md:pt-9 md:pb-10"
			>
				{/* Keyed so a saved value resets the (uncontrolled) form defaults. */}
				<NameField key={user.name ?? ''} editing={editMode === 'name'} />
				<PhoneField key={user.phoneNumber} editing={editMode === 'phone'} />
			</section>

			<section
				aria-label="More settings"
				className="md:bg-surface md:text-surface-foreground mt-8 md:mt-5 md:rounded-[1.5rem] md:px-9 md:py-3"
			>
				<ul className="divide-border divide-y">
					{settingsLinks.map((item) => (
						<li key={item.to}>
							<Link
								to={item.to}
								reloadDocument={item.reloadDocument}
								download={item.download}
								prefetch={item.reloadDocument ? 'none' : 'intent'}
								className="group text-foreground flex items-center justify-between gap-4 py-5 text-base font-medium transition-colors md:py-6 md:text-sm md:font-semibold"
							>
								<span className="flex items-center gap-4">
									<span className="text-foreground group-hover:bg-muted md:bg-muted md:text-muted-foreground md:group-hover:bg-brand-muted md:group-hover:text-brand-muted-foreground md:dark:bg-card flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 md:rounded-lg">
										<Icon name={item.icon} size="sm" aria-hidden="true" />
									</span>
									{item.title}
								</span>
								<Icon
									name="chevron-right"
									size="sm"
									aria-hidden="true"
									className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"
								/>
							</Link>
						</li>
					))}
				</ul>
			</section>

			<div className="mt-10 flex flex-col items-center justify-center gap-4 text-center md:flex-row md:gap-8">
				<SignOutOfSessions count={user.otherSessionsCount} />
				<DeleteData />
			</div>
		</div>
	)
}

function EditToggle({
	editing,
	editTo,
	editLabel,
	formId,
	saveLabel,
	pending,
}: {
	editing: boolean
	editTo: string
	editLabel: string
	formId: string
	saveLabel: string
	pending: boolean
}) {
	if (!editing) {
		return (
			<ButtonLink
				to={editTo}
				preventScrollReset
				variant="outline"
				size="xs"
				className="shrink-0"
			>
				{editLabel}
			</ButtonLink>
		)
	}
	return (
		<div className="flex shrink-0 items-center gap-2">
			<ButtonLink
				to={overviewPath}
				preventScrollReset
				variant="ghost"
				size="xs"
				className="text-muted-foreground"
			>
				Cancel
			</ButtonLink>
			<StatusButton
				form={formId}
				type="submit"
				variant="brand"
				size="xs"
				className="gap-1.5"
				status={pending ? 'pending' : 'idle'}
			>
				{saveLabel}
			</StatusButton>
		</div>
	)
}

function NameField({ editing }: { editing: boolean }) {
	const { user } = useOutletContext<SettingsOutletContext>()
	const fetcher = useFetcher<typeof overviewRouteAction>()
	const inputRef = useRef<HTMLInputElement>(null)
	const [form, fields] = useForm({
		id: 'update-name-form',
		constraint: getZodConstraint(UpdateNameSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: UpdateNameSchema })
		},
		defaultValue: { name: user.name ?? '' },
	})

	useEffect(() => {
		if (editing) inputRef.current?.focus()
	}, [editing])

	return (
		<fetcher.Form method="POST" action={overviewAction} {...getFormProps(form)}>
			<input type="hidden" name="intent" value={updateNameActionIntent} />
			<div className="flex items-center justify-between gap-4">
				<Label htmlFor={fields.name.id}>Your Name</Label>
				<EditToggle
					editing={editing}
					editTo={`${overviewPath}?edit=name`}
					editLabel="Edit Your Name"
					formId={form.id}
					saveLabel="Save Changes"
					pending={fetcher.state !== 'idle'}
				/>
			</div>
			<Input
				{...getInputProps(fields.name, { type: 'text' })}
				ref={inputRef}
				key={`${fields.name.key}-${editing}`}
				readOnly={!editing}
				autoComplete="name"
				aria-invalid={fields.name.errors?.length ? true : undefined}
				aria-describedby={
					fields.name.errors?.length ? fields.name.errorId : undefined
				}
				className={cn('mt-3', readOnlyFieldClassName)}
			/>
			<FieldErrorSlot
				errorId={fields.name.errors?.length ? fields.name.errorId : undefined}
				errors={fields.name.errors}
			/>
			<ErrorList id={form.errorId} errors={form.errors} />
		</fetcher.Form>
	)
}

function PhoneField({ editing }: { editing: boolean }) {
	const { user } = useOutletContext<SettingsOutletContext>()
	const fetcher = useFetcher<typeof changeNumberRouteAction>()
	const inputRef = useRef<HTMLInputElement>(null)
	const parts = splitPhoneNumber(user.phoneNumber)
	const [form, fields] = useForm({
		id: 'change-phone-number-form',
		constraint: getZodConstraint(ChangeNumberSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ChangeNumberSchema })
		},
		defaultValue: {
			countryCode: parts.countryCode,
			phoneNumber: parts.national,
		},
	})
	const phoneErrorId = fields.phoneNumber.errors?.length
		? fields.phoneNumber.errorId
		: undefined

	useEffect(() => {
		if (editing) inputRef.current?.focus()
	}, [editing])

	return (
		<fetcher.Form
			method="POST"
			action={changeNumberAction}
			{...getFormProps(form)}
		>
			<div className="flex items-center justify-between gap-4">
				<Label htmlFor={fields.countryCode.id}>
					<span className="md:hidden">Country Code</span>
					<span className="hidden md:inline">Your Phone Number</span>
				</Label>
				<EditToggle
					editing={editing}
					editTo={`${overviewPath}?edit=phone`}
					editLabel="Edit Your Phone Number"
					formId={form.id}
					saveLabel="Send Verification Code"
					pending={fetcher.state !== 'idle'}
				/>
			</div>
			<div className="mt-3 grid gap-x-4 md:grid-cols-2">
				<div className="relative">
					<select
						id={fields.countryCode.id}
						name={fields.countryCode.name}
						key={`${fields.countryCode.key}-${editing}`}
						defaultValue={parts.countryCode}
						disabled={!editing}
						className={cn(
							selectClassName,
							'disabled:bg-surface disabled:text-muted-foreground md:disabled:bg-muted',
						)}
					>
						{countryCodes.map((code) => (
							<option key={code.value} value={code.value}>
								{countryCodeLabel(code)}
							</option>
						))}
						<option value={OTHER_COUNTRY_CODE}>
							Other (type the full number)
						</option>
					</select>
					{editing ? <SelectChevron /> : null}
				</div>
				<div className="mt-5 md:mt-0">
					<Label
						htmlFor={fields.phoneNumber.id}
						className="mb-3 block md:sr-only"
					>
						Phone Number
					</Label>
					<Input
						{...getInputProps(fields.phoneNumber, { type: 'tel' })}
						ref={inputRef}
						key={`${fields.phoneNumber.key}-${editing}`}
						readOnly={!editing}
						autoComplete="tel-national"
						placeholder="123 456 7890"
						aria-invalid={phoneErrorId ? true : undefined}
						aria-describedby={phoneErrorId}
						className={readOnlyFieldClassName}
					/>
				</div>
			</div>
			<FieldErrorSlot
				errorId={phoneErrorId}
				errors={fields.phoneNumber.errors}
			/>
			<ErrorList id={form.errorId} errors={form.errors} />
		</fetcher.Form>
	)
}

function SignOutOfSessions({ count }: { count: number }) {
	const dc = useDoubleCheck()
	const fetcher = useFetcher()
	if (!count) return null
	return (
		<fetcher.Form method="POST" action={overviewAction}>
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: signOutOfSessionsActionIntent,
				})}
				variant={dc.doubleCheck ? 'destructive' : 'link'}
				size="sm"
				className={cn(
					'text-base md:text-sm',
					!dc.doubleCheck && 'text-muted-foreground hover:text-foreground px-0',
				)}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
			>
				{dc.doubleCheck
					? 'Are you sure?'
					: `Sign out of ${count} other ${count === 1 ? 'session' : 'sessions'}`}
			</StatusButton>
		</fetcher.Form>
	)
}

function DeleteData() {
	const dc = useDoubleCheck()
	const fetcher = useFetcher()
	return (
		<fetcher.Form method="POST" action={overviewAction}>
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: deleteDataActionIntent,
				})}
				variant={dc.doubleCheck ? 'destructive' : 'link'}
				size="sm"
				className={cn(
					'text-base md:text-sm',
					!dc.doubleCheck && 'text-muted-foreground hover:text-foreground px-0',
				)}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
			>
				{dc.doubleCheck
					? 'Are you sure? This cannot be undone'
					: 'Delete Account'}
			</StatusButton>
		</fetcher.Form>
	)
}
