import { getFormProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	type MetaFunction,
} from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDoubleCheck, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithPermission } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { userHasPermission, useOptionalUser } from '#app/utils/user.ts'
import { type loader as recipientsLoader } from './receipients.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId },
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			userId: true,
			messages: {
				select: { id: true, content: true },
				orderBy: { order: 'asc' },
				where: { sentAt: undefined },
			},
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	return json({ recipient })
}

const DeleteFormSchema = z.object({
	intent: z.literal('delete-note'),
	noteId: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: DeleteFormSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { noteId } = submission.value

	const recipient = await prisma.recipient.findFirst({
		select: { id: true, userId: true, user: { select: { username: true } } },
		where: { id: noteId },
	})
	invariantResponse(recipient, 'Not found', { status: 404 })

	const isOwner = recipient.userId === userId
	await requireUserWithPermission(
		request,
		isOwner ? `delete:note:own` : `delete:note:any`,
	)

	await prisma.recipient.delete({ where: { id: recipient.id } })

	return redirectWithToast(`/users/${recipient.user.username}/recipients`, {
		type: 'success',
		title: 'Success',
		description: 'Your recipient has been deleted.',
	})
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const isOwner = user?.id === data.recipient.userId
	const canDelete = userHasPermission(
		user,
		isOwner ? `delete:note:own` : `delete:note:any`,
	)
	const displayBar = canDelete || isOwner

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">
				{data.recipient.name}
				<small className="block text-sm text-secondary-foreground">
					{data.recipient.phoneNumber}
				</small>
			</h2>
			<div className={`${displayBar ? 'pb-24' : 'pb-12'} overflow-y-auto`}>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					{data.recipient.phoneNumber}
				</p>
			</div>
			{displayBar ? (
				<div className={floatingToolbarClassName}>
					<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
						{canDelete ? <DeleteRecipient id={data.recipient.id} /> : null}
						<Button
							asChild
							className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0"
						>
							<Link to="edit">
								<Icon name="pencil-1" className="scale-125 max-md:scale-150">
									<span className="max-md:hidden">Edit</span>
								</Icon>
							</Link>
						</Button>
					</div>
				</div>
			) : null}
		</div>
	)
}

export function DeleteRecipient({ id }: { id: string }) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const dc = useDoubleCheck()
	const [form] = useForm({
		id: 'delete-note',
		lastResult: actionData?.result,
	})

	return (
		<Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="noteId" value={id} />
			<StatusButton
				type="submit"
				name="intent"
				value="delete-note"
				variant="destructive"
				status={isPending ? 'pending' : form.status ?? 'idle'}
				disabled={isPending}
				className="w-full max-md:aspect-square max-md:px-0"
			>
				<Icon
					name="trash"
					className={cn(
						'scale-125 max-md:scale-150',
						// TODO: this probably doesn't work. Fix this later...
						dc.doubleCheck ? 'mix-blend-darken' : '',
					)}
				>
					<span className="max-md:hidden">
						{dc.doubleCheck ? `Confirm` : `Delete`}
					</span>
				</Icon>
			</StatusButton>
			<ErrorList errors={form.errors} id={form.errorId} />
		</Form>
	)
}

export const meta: MetaFunction<
	typeof loader,
	{ 'routes/users+/$username_+/recipients': typeof recipientsLoader }
> = ({ data, params, matches }) => {
	const recipientssMatch = matches.find(
		m => m.id === 'routes/users+/$username_+/recipients',
	)
	const displayName = recipientssMatch?.data?.owner.name ?? params.username
	const recipientTitle =
		data?.recipient.name ?? data?.recipient.phoneNumber ?? 'Recipient'
	return [
		{ title: `${recipientTitle} | ${displayName}'s Recipients | GratiText` },
		{
			name: 'description',
			content: `GratiTexts sent to ${recipientTitle} from ${displayName}'s`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
