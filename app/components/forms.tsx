import { useInputControl } from '@conform-to/react'
import {
	REGEXP_ONLY_DIGITS_AND_CHARS,
	REGEXP_ONLY_DIGITS,
	type OTPInputProps,
} from 'input-otp'
import React, { useId, useState } from 'react'
import { cn } from '#app/utils/misc.tsx'
import { Checkbox, type CheckboxProps } from './ui/checkbox.tsx'
import { Icon } from './ui/icon.tsx'
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from './ui/input-otp.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { Textarea } from './ui/textarea.tsx'

export type ListOfErrors = Array<string | null | undefined> | null | undefined

export function ErrorList({
	id,
	errors,
}: {
	errors?: ListOfErrors
	id?: string
}) {
	const errorsToRender = errors?.filter(Boolean)
	if (!errorsToRender?.length) return null
	return (
		<ul id={id} className="flex flex-col gap-1">
			{errorsToRender.map((e) => (
				<li key={e} className="text-foreground-destructive text-xs">
					{e}
				</li>
			))}
		</ul>
	)
}

/** Reserves the error row below a control so layouts do not jump. */
export function FieldErrorSlot({
	errorId,
	errors,
	align = 'right',
}: {
	errorId?: string
	errors?: ListOfErrors
	align?: 'left' | 'right'
}) {
	return (
		<div
			className={cn(
				'min-h-6 px-1 pt-1.5',
				align === 'right' ? 'text-right' : 'text-left',
			)}
		>
			{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
		</div>
	)
}

export function Field({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: React.ComponentProps<'input'>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = inputProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<Input
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
				className={cn('mt-3', inputProps.className)}
			/>
			<FieldErrorSlot errorId={errorId} errors={errors} />
		</div>
	)
}

export function PasswordField({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: React.ComponentProps<'input'>
	errors?: ListOfErrors
	className?: string
}) {
	const [visible, setVisible] = useState(false)
	const fallbackId = useId()
	const id = inputProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<div className="relative mt-3">
				<Input
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					{...inputProps}
					type={visible ? 'text' : 'password'}
					className={cn('pr-14', inputProps.className)}
				/>
				<button
					type="button"
					onClick={() => setVisible((v) => !v)}
					aria-label={visible ? 'Hide password' : 'Show password'}
					aria-pressed={visible}
					className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
				>
					<Icon
						name={visible ? 'eye-off' : 'eye'}
						size="sm"
						aria-hidden="true"
					/>
				</button>
			</div>
			<FieldErrorSlot errorId={errorId} errors={errors} />
		</div>
	)
}

export const selectClassName =
	'border-input bg-field text-field-foreground focus-visible:border-ring disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid flex h-14 w-full appearance-none rounded-full border px-5 pr-12 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:border-transparent'

export function SelectChevron({ className }: { className?: string }) {
	return (
		<Icon
			name="chevron-down"
			size="sm"
			aria-hidden="true"
			className={cn(
				'text-muted-foreground pointer-events-none absolute top-1/2 right-5 -translate-y-1/2',
				className,
			)}
		/>
	)
}

export function SelectField({
	labelProps,
	selectProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	selectProps: React.ComponentProps<'select'>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = selectProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<div className="relative mt-3">
				<select
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					{...selectProps}
					className={cn(selectClassName, selectProps.className)}
				/>
				<SelectChevron />
			</div>
			<FieldErrorSlot errorId={errorId} errors={errors} />
		</div>
	)
}

export function OTPField({
	labelProps,
	inputProps,
	errors,
	className,
	type,
	slotClassName,
	groupClassName,
	separatorClassName,
	showSeparator = true,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: Partial<OTPInputProps & { render: never }>
	errors?: ListOfErrors
	className?: string
	type: 'digits' | 'digits-and-characters'
	slotClassName?: string
	groupClassName?: string
	separatorClassName?: string
	showSeparator?: boolean
}) {
	const fallbackId = useId()
	const id = inputProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} className="mb-3" />
			<InputOTP
				pattern={
					type === 'digits' ? REGEXP_ONLY_DIGITS : REGEXP_ONLY_DIGITS_AND_CHARS
				}
				type={type === 'digits' ? 'number' : 'text'}
				maxLength={6}
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			>
				<InputOTPGroup className={groupClassName}>
					<InputOTPSlot className={slotClassName} index={0} />
					<InputOTPSlot className={slotClassName} index={1} />
					<InputOTPSlot className={slotClassName} index={2} />
				</InputOTPGroup>
				{showSeparator ? (
					<InputOTPSeparator className={separatorClassName} />
				) : null}
				<InputOTPGroup className={groupClassName}>
					<InputOTPSlot className={slotClassName} index={3} />
					<InputOTPSlot className={slotClassName} index={4} />
					<InputOTPSlot className={slotClassName} index={5} />
				</InputOTPGroup>
			</InputOTP>
			<FieldErrorSlot errorId={errorId} errors={errors} align="left" />
		</div>
	)
}

export function TextareaField({
	labelProps,
	textareaProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	textareaProps: React.ComponentProps<'textarea'>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = textareaProps.id ?? textareaProps.name ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<Textarea
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...textareaProps}
				className={cn('mt-3', textareaProps.className)}
			/>
			<FieldErrorSlot errorId={errorId} errors={errors} />
		</div>
	)
}

export function CheckboxField({
	labelProps,
	buttonProps,
	description,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	buttonProps: CheckboxProps & {
		name: string
		form: string
		value?: string
	}
	/**
	 * Rendered next to the label but outside of it, so it is the right place
	 * for links and other interactive content that must not toggle the box.
	 */
	description?: React.ReactNode
	errors?: ListOfErrors
	className?: string
}) {
	const { key, defaultChecked, ...checkboxProps } = buttonProps
	const fallbackId = useId()
	const checkedValue = buttonProps.value ?? 'on'
	const input = useInputControl({
		key,
		name: buttonProps.name,
		formId: buttonProps.form,
		initialValue: defaultChecked ? checkedValue : undefined,
	})
	const id = buttonProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	const descriptionId = description ? `${id}-description` : undefined
	const describedBy =
		[descriptionId, errorId].filter(Boolean).join(' ') || undefined

	return (
		<div className={className}>
			<div className="flex items-start gap-3">
				<Checkbox
					{...checkboxProps}
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={describedBy}
					checked={input.value === checkedValue}
					onCheckedChange={(state) => {
						input.change(state.valueOf() ? checkedValue : '')
						buttonProps.onCheckedChange?.(state)
					}}
					onFocus={(event) => {
						input.focus()
						buttonProps.onFocus?.(event)
					}}
					onBlur={(event) => {
						input.blur()
						buttonProps.onBlur?.(event)
					}}
					type="button"
				/>
				<div className="grid gap-1 pt-0.5">
					<label
						htmlFor={id}
						{...labelProps}
						className="text-foreground cursor-pointer text-sm leading-snug [&_a]:font-semibold [&_a]:underline-offset-4 hover:[&_a]:underline"
					/>
					{description ? (
						<div
							id={descriptionId}
							className="text-muted-foreground text-sm leading-snug"
						>
							{description}
						</div>
					) : null}
				</div>
			</div>
			{errorId ? (
				<div className="pt-2 pl-9">
					<ErrorList id={errorId} errors={errors} />
				</div>
			) : null}
		</div>
	)
}
