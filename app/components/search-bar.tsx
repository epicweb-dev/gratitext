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
			className="flex flex-wrap items-center justify-center gap-2"
			onChange={(e) => autoSubmit && handleFormChange(e.currentTarget)}
		>
			<div className="flex-1">
				<Label htmlFor={id} className="sr-only">
					Search
				</Label>
				<Input
					type="search"
					name="search"
					id={id}
					defaultValue={searchParams.get('search') ?? ''}
					placeholder="Search"
					className="w-full bg-white"
					autoFocus={autoFocus}
				/>
			</div>
			{showDateFilter ? (
				<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
					<div className="w-full sm:w-[160px]">
						<Label htmlFor={startDateId} className="sr-only">
							Start date
						</Label>
						<Input
							type="date"
							name="startDate"
							id={startDateId}
							defaultValue={startDateValue}
							className="w-full bg-white"
						/>
					</div>
					<div className="w-full sm:w-[160px]">
						<Label htmlFor={endDateId} className="sr-only">
							End date
						</Label>
						<Input
							type="date"
							name="endDate"
							id={endDateId}
							defaultValue={endDateValue}
							className="w-full bg-white"
						/>
					</div>
				</div>
			) : null}
			<div>
				<StatusButton
					type="submit"
					status={isSubmitting ? 'pending' : status}
					className="flex w-full items-center justify-center"
				>
					<Icon name="magnifying-glass" size="md" />
					<span className="sr-only">Search</span>
				</StatusButton>
			</div>
		</Form>
	)
}
