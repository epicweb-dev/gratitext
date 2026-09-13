import { useId, useRef } from 'react'
import { Form, useSearchParams, useSubmit } from 'react-router'
import { useDebounce, useIsPending } from '#app/utils/misc.tsx'
import { Icon } from './ui/icon.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { StatusButton } from './ui/status-button.tsx'

export function SearchBar({
	status,
	autoFocus = false,
	autoSubmit = false,
	action,
	showDateFilter = false,
}: {
	status: 'idle' | 'pending' | 'success' | 'error'
	autoFocus?: boolean
	autoSubmit?: boolean
	action?: string
	showDateFilter?: boolean
}) {
	const id = useId()
	const formRef = useRef<HTMLFormElement>(null)
	const startDateId = `${id}-start-date`
	const endDateId = `${id}-end-date`
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const isSubmitting = useIsPending({
		formMethod: 'GET',
		formAction: action,
	})
	const searchValue = searchParams.get('search') ?? ''
	const startDateValue = searchParams.get('startDate') ?? ''
	const endDateValue = searchParams.get('endDate') ?? ''
	const hasActiveFilters = Boolean(
		searchValue || startDateValue || endDateValue,
	)

	const handleFormChange = useDebounce((form: HTMLFormElement) => {
		void submit(form)
	}, 400)

	return (
		<Form
			ref={formRef}
			method="GET"
			action={action}
			role="search"
			className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
			onChange={(e) => autoSubmit && handleFormChange(e.currentTarget)}
		>
			<div className="flex w-full items-center gap-2 sm:flex-1">
				<div className="relative min-w-0 flex-1">
					<Label htmlFor={id} className="sr-only">
						Search messages
					</Label>
					<Icon
						name="magnifying-glass"
						size="sm"
						aria-hidden="true"
						className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
					/>
					<Input
						type="search"
						name="search"
						id={id}
						defaultValue={searchValue}
						placeholder="Search messages"
						className="w-full pl-11"
						autoFocus={autoFocus}
					/>
				</div>
				<StatusButton
					type="submit"
					size="icon-lg"
					variant="secondary"
					status={isSubmitting ? 'pending' : status}
					className="shrink-0"
				>
					<Icon name="magnifying-glass" size="md" />
					<span className="sr-only">Search</span>
				</StatusButton>
			</div>
			{showDateFilter ? (
				<div className="grid w-full gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:items-end">
					<div className="min-w-0 sm:w-[160px]">
						<Label htmlFor={startDateId}>From</Label>
						<Input
							type="date"
							name="startDate"
							id={startDateId}
							defaultValue={startDateValue}
							className="mt-2 w-full min-w-0 px-3 text-sm"
						/>
					</div>
					<div className="min-w-0 sm:w-[160px]">
						<Label htmlFor={endDateId}>To</Label>
						<Input
							type="date"
							name="endDate"
							id={endDateId}
							defaultValue={endDateValue}
							className="mt-2 w-full min-w-0 px-3 text-sm"
						/>
					</div>
				</div>
			) : null}
			{hasActiveFilters ? (
				<div className="w-full">
					<button
						type="button"
						onClick={() => {
							const form = formRef.current
							if (!form) return
							for (const element of Array.from(form.elements)) {
								if (element instanceof HTMLInputElement) element.value = ''
							}
							void submit(form)
						}}
						className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
					>
						<Icon name="cross-1" size="xs" aria-hidden="true" />
						Clear search and filters
					</button>
				</div>
			) : null}
		</Form>
	)
}
