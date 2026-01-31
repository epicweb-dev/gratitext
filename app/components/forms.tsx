import { useInputControl } from '@conform-to/react'
import {
	REGEXP_ONLY_DIGITS_AND_CHARS,
	REGEXP_ONLY_DIGITS,
	type OTPInputProps,
} from 'input-otp'
import React, { useId } from 'react'
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
				<li key={e} className="text-foreground-destructive text-xs font-medium">
					{e}
				</li>
			))}
		</ul>
	)
}

export function Field({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: React.InputHTMLAttributes<HTMLInputElement>
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
			/>
			<div className="min-h-[24px] px-4 pt-2 pb-2">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function SelectField({
	labelProps,
	selectProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	selectProps: React.SelectHTMLAttributes<HTMLSelectElement>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = selectProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<div className="relative">
				<select
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					className="border-input bg-card text-foreground placeholder:text-muted-secondary-foreground focus-visible:border-ring focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground aria-[invalid]:border-input-invalid aria-[invalid]:text-foreground-destructive aria-[invalid]:focus-visible:ring-foreground-destructive flex h-12 w-full appearance-none rounded-full border px-4 pr-10 text-base font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed"
					{...selectProps}
				/>
				<Icon
					name="chevron-down"
					size="sm"
					aria-hidden="true"
					className="text-muted-secondary-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
				/>
			</div>
			<div className="min-h-[24px] px-4 pt-2 pb-2">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
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
			<Label htmlFor={id} {...labelProps} />
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
			<div className="min-h-[24px] px-4 pt-2 pb-2">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
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
	textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement>
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
			/>
			<div className="min-h-[24px] px-4 pt-2 pb-2">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function CheckboxField({
	labelProps,
	buttonProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	buttonProps: CheckboxProps & {
		name: string
		form: string
		value?: string
	}
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

	return (
		<div className={className}>
			<div className="flex gap-2">
				<Checkbox
					{...checkboxProps}
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
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
				<label
					htmlFor={id}
					{...labelProps}
					className="text-body-xs text-muted-foreground self-center"
				/>
			</div>
			<div className="px-4 pt-2 pb-2">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}
