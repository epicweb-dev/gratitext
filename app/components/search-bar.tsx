import { useId } from 'react'
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
	const startDateId = `${id}-start-date`
	const endDateId = `${id}-end-date`
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const isSubmitting = useIsPending({
		formMethod: 'GET',
		formAction: action,
	})
	const startDateValue = searchParams.get('startDate') ?? ''
	const endDateValue = searchParams.get('endDate') ?? ''

	const handleFormChange = useDebounce((form: HTMLFormElement) => {
		void submit(form)
	}, 400)

	return (
		<Form
			method="GET"
			action={action}
			className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
			onChange={(e) => autoSubmit && handleFormChange(e.currentTarget)}
		>
			<div className="flex w-full items-center gap-2 sm:flex-1">
				<div className="min-w-0 flex-1">
					<Label htmlFor={id} className="sr-only">
						Search
					</Label>
					<Input
						type="search"
						name="search"
						id={id}
						defaultValue={searchParams.get('search') ?? ''}
						placeholder="Search"
						className="w-full"
						autoFocus={autoFocus}
					/>
				</div>
				<StatusButton
					type="submit"
					size="icon-lg"
					status={isSubmitting ? 'pending' : status}
					className="shrink-0"
				>
					<Icon name="magnifying-glass" size="md" />
					<span className="sr-only">Search</span>
				</StatusButton>
			</div>
			{showDateFilter ? (
				<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-end">
					<div className="min-w-0 space-y-1 sm:w-[160px]">
						<Label htmlFor={startDateId}>Start date</Label>
						<Input
							type="date"
							name="startDate"
							id={startDateId}
							defaultValue={startDateValue}
							className="w-full"
						/>
					</div>
					<div className="min-w-0 space-y-1 sm:w-[160px]">
						<Label htmlFor={endDateId}>End date</Label>
						<Input
							type="date"
							name="endDate"
							id={endDateId}
							defaultValue={endDateValue}
							className="w-full"
						/>
					</div>
				</div>
			) : null}
		</Form>
	)
}
