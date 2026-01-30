import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from 'react-router'
import { Link, useFetcher, useLoaderData } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck } from '#app/utils/misc.tsx'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { NameSchema, UsernameSchema } from '#app/utils/user-validation.ts'
import { twoFAVerificationType } from './two-factor.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const ProfileFormSchema = z.object({
	name: NameSchema.optional(),
	username: UsernameSchema,
})

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			username: true,
			phoneNumber: true,
			_count: {
				select: {
					sessions: {
						where: {
							expirationDate: { gt: new Date() },
						},
					},
				},
			},
		},
	})

	const twoFactorVerification = await prisma.verification.findUnique({
		select: { id: true },
		where: { target_type: { type: twoFAVerificationType, target: userId } },
	})

	return json({
		user,
		isTwoFactorEnabled: Boolean(twoFactorVerification),
	})
}

type ProfileActionArgs = {
	request: Request
	userId: string
	formData: FormData
}
const profileUpdateActionIntent = 'update-profile'
const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
const deleteDataActionIntent = 'delete-data'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	switch (intent) {
		case profileUpdateActionIntent: {
			return profileUpdateAction({ request, userId, formData })
		}
		case signOutOfSessionsActionIntent: {
			return signOutOfSessionsAction({ request, userId, formData })
		}
		case deleteDataActionIntent: {
			return deleteDataAction({ request, userId, formData })
		}
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

export default function EditUserProfile() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-10 pb-16">
			<div className="text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
					GratiText
				</p>
				<h1 className="mt-3 text-4xl font-bold text-foreground">
					Hi {data.user.name ?? data.user.username}!
				</h1>
			</div>
			<div className="rounded-[32px] border border-border bg-card p-8 shadow-sm">
				<UpdateProfile />
			</div>
			<div className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
				<ul className="divide-y divide-border">
					<li>
						<Link
							to="subscription"
							className="flex items-center justify-between gap-4 py-4"
						>
							<span className="flex items-center gap-3 text-sm font-semibold text-foreground">
								<span className="rounded-xl bg-muted p-2 text-muted-foreground">
									<Icon name="banknotes-outline" size="sm" />
								</span>
								Manage Your Subscriptions
							</span>
							<Icon name="chevron-right" size="sm" />
						</Link>
					</li>
					<li>
						<Link
							to="password"
							className="flex items-center justify-between gap-4 py-4"
						>
							<span className="flex items-center gap-3 text-sm font-semibold text-foreground">
								<span className="rounded-xl bg-muted p-2 text-muted-foreground">
									<Icon name="password" size="sm" />
								</span>
								Change Password
							</span>
							<Icon name="chevron-right" size="sm" />
						</Link>
					</li>
					<li>
						<Link
							reloadDocument
							download="my-gratitext-data.json"
							to="/resources/download-user-data"
							className="flex items-center justify-between gap-4 py-4"
						>
							<span className="flex items-center gap-3 text-sm font-semibold text-foreground">
								<span className="rounded-xl bg-muted p-2 text-muted-foreground">
									<Icon name="download" size="sm" />
								</span>
								Download Your Data
							</span>
							<Icon name="chevron-right" size="sm" />
						</Link>
					</li>
					<li>
						<Link
							to="two-factor"
							className="flex items-center justify-between gap-4 py-4"
						>
							<span className="flex items-center gap-3 text-sm font-semibold text-foreground">
								<span className="rounded-xl bg-muted p-2 text-muted-foreground">
									<Icon
										name={data.isTwoFactorEnabled ? 'lock-closed' : 'lock-open-1'}
										size="sm"
									/>
								</span>
								{data.isTwoFactorEnabled ? '2FA is Enabled' : 'Enable 2FA'}
							</span>
							<Icon name="chevron-right" size="sm" />
						</Link>
					</li>
				</ul>
			</div>
			<div className="flex flex-col items-center gap-4 text-center">
				<SignOutOfSessions />
				<DeleteData />
			</div>
		</div>
	)
}

async function profileUpdateAction({ userId, formData }: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		async: true,
		schema: ProfileFormSchema.superRefine(async ({ username }, ctx) => {
			const existingUsername = await prisma.user.findUnique({
				where: { username },
				select: { id: true },
			})
			if (existingUsername && existingUsername.id !== userId) {
				ctx.addIssue({
					path: ['username'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this username',
				})
			}
		}),
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value

	await prisma.user.update({
		select: { username: true },
		where: { id: userId },
		data: {
			name: data.name,
			username: data.username,
		},
	})

	return json({
		result: submission.reply(),
	})
}

function UpdateProfile() {
	const data = useLoaderData<typeof loader>()

	const fetcher = useFetcher<typeof profileUpdateAction>()

	const [form, fields] = useForm({
		id: 'edit-profile',
		constraint: getZodConstraint(ProfileFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ProfileFormSchema })
		},
		defaultValue: {
			username: data.user.username,
			name: data.user.name,
		},
	})

	return (
		<fetcher.Form
			method="POST"
			{...getFormProps(form)}
			className="flex flex-col gap-6"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
					Your Name
				</p>
				<StatusButton
					type="submit"
					size="sm"
					name="intent"
					value={profileUpdateActionIntent}
					status={
						fetcher.state !== 'idle' ? 'pending' : (form.status ?? 'idle')
					}
					className="bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
				>
					Save Changes
				</StatusButton>
		</div>
		<Field
			labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
			inputProps={{
				...getInputProps(fields.username, { type: 'text' }),
				className: 'lowercase',
			}}
			errors={fields.username.errors}
		/>
		<Field
			labelProps={{ htmlFor: fields.name.id, children: 'Your Name' }}
			inputProps={getInputProps(fields.name, { type: 'text' })}
			errors={fields.name.errors}
		/>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
					Your Phone Number
				</p>
				<ButtonLink variant="secondary" size="sm" to="change-number">
					Edit Your Phone Number
				</ButtonLink>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-full border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
					Country Code
				</div>
				<div className="rounded-full border border-border bg-muted px-4 py-3 text-sm text-foreground">
					{data.user.phoneNumber}
				</div>
			</div>
			<ErrorList errors={form.errors} id={form.errorId} />
		</fetcher.Form>
	)
}

async function signOutOfSessionsAction({ request, userId }: ProfileActionArgs) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	invariantResponse(
		sessionId,
		'You must be authenticated to sign out of other sessions',
	)
	await prisma.session.deleteMany({
		where: {
			userId,
			id: { not: sessionId },
		},
	})
	return json({ status: 'success' } as const)
}

function SignOutOfSessions() {
	const data = useLoaderData<typeof loader>()
	const dc = useDoubleCheck()

	const fetcher = useFetcher<typeof signOutOfSessionsAction>()
	const otherSessionsCount = data.user._count.sessions - 1
	return (
		<div>
			{otherSessionsCount ? (
				<fetcher.Form method="POST">
					<StatusButton
						{...dc.getButtonProps({
							type: 'submit',
							name: 'intent',
							value: signOutOfSessionsActionIntent,
						})}
						variant={dc.doubleCheck ? 'destructive' : 'secondary'}
						status={
							fetcher.state !== 'idle'
								? 'pending'
								: (fetcher.data?.status ?? 'idle')
						}
					>
						<Icon name="avatar">
							{dc.doubleCheck
								? `Are you sure?`
								: `Sign out of ${otherSessionsCount} other sessions`}
						</Icon>
					</StatusButton>
				</fetcher.Form>
			) : (
				<p className="text-sm text-muted-foreground">
					This is your only session.
				</p>
			)}
		</div>
	)
}

async function deleteDataAction({ userId }: ProfileActionArgs) {
	await prisma.user.delete({ where: { id: userId } })
	return redirectWithToast('/', {
		type: 'success',
		title: 'Data Deleted',
		description: 'All of your data has been deleted',
	})
}

function DeleteData() {
	const dc = useDoubleCheck()

	const fetcher = useFetcher<typeof deleteDataAction>()
	return (
		<fetcher.Form method="POST">
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: deleteDataActionIntent,
				})}
				variant={dc.doubleCheck ? 'destructive' : 'ghost'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				className="text-sm font-semibold text-foreground"
			>
				<Icon name="trash">
					{dc.doubleCheck ? `Are you sure?` : `Delete Account`}
				</Icon>
			</StatusButton>
		</fetcher.Form>
	)
}
