import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	type LoaderFunctionArgs,
	json,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { Field } from '#app/components/forms.js'
import { Spacer } from '#app/components/spacer.js'
import { StatusButton } from '#app/components/ui/status-button.js'
import { prisma } from '#app/utils/db.server.js'
import { useDoubleCheck } from '#app/utils/misc.js'
import { requireUserWithRole } from '#app/utils/permissions.server.js'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const sourceNumbers = await prisma.sourceNumber.findMany({
		select: { id: true, phoneNumber: true },
	})
	return json({ sourceNumbers })
}

type SourceActionArgs = {
	request: Request
	formData: FormData
}

const createSourceActionIntent = 'create-message'
const deleteSourceActionIntent = 'delete-message'
const updateSourceActionIntent = 'update-message'

export async function action({ request }: ActionFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')
	switch (intent) {
		case createSourceActionIntent: {
			return createSourceAction({ request, formData })
		}
		case deleteSourceActionIntent: {
			return deleteSourceAction({ request, formData })
		}
		case updateSourceActionIntent: {
			return updateSourceAction({ request, formData })
		}
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

const CreateSourceFormSchema = z.object({
	phoneNumber: z.string().min(1).max(20),
})
async function createSourceAction({ formData }: SourceActionArgs) {
	const submission = parseWithZod(formData, { schema: CreateSourceFormSchema })

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { phoneNumber } = submission.value

	await prisma.sourceNumber.create({
		data: { phoneNumber },
	})

	return json({ result: submission.reply() })
}

const DeleteSourceFormSchema = z.object({
	id: z.string().min(1),
})
async function deleteSourceAction({ formData }: SourceActionArgs) {
	const submission = parseWithZod(formData, { schema: DeleteSourceFormSchema })

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { id } = submission.value

	await prisma.sourceNumber.delete({ where: { id } })

	return json({ result: submission.reply() })
}

const UpdateSourceFormSchema = z.object({
	id: z.string().min(1),
	phoneNumber: z.string().min(1).max(20),
})
async function updateSourceAction({ formData }: SourceActionArgs) {
	const submission = parseWithZod(formData, { schema: UpdateSourceFormSchema })

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { id, phoneNumber } = submission.value

	await prisma.sourceNumber.update({ where: { id }, data: { phoneNumber } })

	return json({ result: submission.reply() })
}

export default function Source() {
	const data = useLoaderData<typeof loader>()
	return (
		<div className="container">
			<h1 className="text-h1">Source Numbers</h1>
			<p>
				Source numbers are the numbers used to send the messages. Right now we
				only support one of these, but maybe we'll support more in the future?
				You get it from Twilio.
			</p>
			<Spacer size="sm" />
			<div>
				<h2 className="text-h2">Source Numbers</h2>
				<ul>
					{data.sourceNumbers.map((sourceNumber) => (
						<li key={sourceNumber.id}>
							<EditSourceForm
								id={sourceNumber.id}
								phoneNumber={sourceNumber.phoneNumber}
							/>
						</li>
					))}
				</ul>
			</div>
			<Spacer size="sm" />
			<div className="max-w-64">
				<h2 className="text-h2">Create New Source Number</h2>
				<CreateForm />
			</div>
		</div>
	)
}

function CreateForm() {
	const fetcher = useFetcher<typeof createSourceAction>()
	const [form, fields] = useForm({
		constraint: getZodConstraint(CreateSourceFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: CreateSourceFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})
	return (
		<fetcher.Form
			method="POST"
			{...getFormProps(form)}
			className="flex items-center gap-2"
		>
			<Field
				labelProps={{ children: 'Phone Number' }}
				inputProps={getInputProps(fields.phoneNumber, { type: 'tel' })}
				errors={fields.phoneNumber.errors}
			/>
			<StatusButton
				status={
					fetcher.state !== 'idle'
						? 'pending'
						: (fetcher.data?.result.status ?? 'idle')
				}
				type="submit"
				name="intent"
				value={createSourceActionIntent}
			>
				Create
			</StatusButton>
		</fetcher.Form>
	)
}

function DeleteSourceForm({ id }: { id: string }) {
	const fetcher = useFetcher<typeof deleteSourceAction>()
	const [form] = useForm({
		constraint: getZodConstraint(DeleteSourceFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: DeleteSourceFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})
	const dc = useDoubleCheck()
	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="id" value={id} />
			<StatusButton
				status={
					fetcher.state !== 'idle'
						? 'pending'
						: (fetcher.data?.result.status ?? 'idle')
				}
				variant={dc.doubleCheck ? 'destructive' : 'ghost'}
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: deleteSourceActionIntent,
				})}
			>
				{dc.doubleCheck ? 'Confirm' : 'Delete'}
			</StatusButton>
		</fetcher.Form>
	)
}

function EditSourceForm({
	id,
	phoneNumber,
}: {
	id: string
	phoneNumber: string
}) {
	const fetcher = useFetcher<typeof updateSourceAction>()
	const [form, fields] = useForm({
		constraint: getZodConstraint(UpdateSourceFormSchema),
		lastResult: fetcher.data?.result,
		defaultValue: { phoneNumber },
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: UpdateSourceFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})
	return (
		<div className="flex items-center gap-2">
			<fetcher.Form method="POST" {...getFormProps(form)}>
				<input type="hidden" name="id" value={id} />
				<Field
					labelProps={{ children: 'Phone Number' }}
					inputProps={getInputProps(fields.phoneNumber, { type: 'tel' })}
					errors={fields.phoneNumber.errors}
				/>
			</fetcher.Form>
			<div className="flex flex-col gap-2">
				<StatusButton
					form={form.id}
					status={
						fetcher.state !== 'idle'
							? 'pending'
							: (fetcher.data?.result.status ?? 'idle')
					}
					type="submit"
					name="intent"
					value={updateSourceActionIntent}
				>
					Update
				</StatusButton>

				<DeleteSourceForm id={id} />
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
			}}
		/>
	)
}
