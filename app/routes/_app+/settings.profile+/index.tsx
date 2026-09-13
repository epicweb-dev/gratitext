import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	Link,
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	useFetcher,
	useLoaderData,
} from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon, type IconName } from '#app/components/ui/icon.tsx'
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

	const settingsLinks: Array<{
		to: string
		icon: IconName
		title: string
		description: string
		reloadDocument?: boolean
		download?: string
	}> = [
		{
			to: 'subscription',
			icon: 'banknotes-outline',
			title: 'Subscription',
			description: 'Choose a plan, update billing, or cancel.',
		},
		{
			to: 'password',
			icon: 'password',
			title: 'Change Password',
			description: 'Pick a new password for your account.',
		},
		{
			to: 'two-factor',
			icon: data.isTwoFactorEnabled ? 'lock-closed' : 'lock-open-1',
			title: data.isTwoFactorEnabled ? '2FA is enabled' : 'Enable 2FA',
			description: data.isTwoFactorEnabled
				? 'Manage or disable two-factor authentication.'
				: 'Add an extra layer of security to your login.',
		},
		{
			to: '/resources/download-user-data',
			icon: 'download',
			title: 'Download Your Data',
			description: 'Export everything we store about you as JSON.',
			reloadDocument: true,
			download: 'my-gratitext-data.json',
		},
	]

	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="text-foreground font-serif text-3xl font-semibold sm:text-4xl">
					Account settings
				</h1>
				<p className="text-muted-foreground mt-1 text-sm sm:text-base">
					Signed in as{' '}
					<span className="text-foreground font-semibold">
						@{data.user.username}
					</span>
				</p>
			</div>
			<section
				aria-labelledby="profile-heading"
				className="border-border bg-card rounded-[32px] border p-6 shadow-sm sm:p-8"
			>
				<UpdateProfile />
			</section>
			<section
				aria-labelledby="more-settings-heading"
				className="border-border bg-card rounded-[32px] border px-6 py-2 shadow-sm sm:px-8"
			>
				<h2 id="more-settings-heading" className="sr-only">
					More settings
				</h2>
				<ul className="divide-border divide-y">
					{settingsLinks.map((item) => (
						<li key={item.to}>
							<Link
								to={item.to}
								reloadDocument={item.reloadDocument}
								download={item.download}
								prefetch={item.reloadDocument ? 'none' : 'intent'}
								className="group -mx-2 flex items-center justify-between gap-4 rounded-2xl px-2 py-4 transition-colors"
							>
								<span className="flex items-center gap-4">
									<span className="bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors">
										<Icon name={item.icon} size="sm" aria-hidden="true" />
									</span>
									<span>
										<span className="text-foreground block text-sm font-semibold">
											{item.title}
										</span>
										<span className="text-muted-foreground block text-sm">
											{item.description}
										</span>
									</span>
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
			<section
				aria-labelledby="danger-heading"
				className="border-border rounded-[32px] border border-dashed p-6 sm:p-8"
			>
				<h2 id="danger-heading" className="text-foreground text-lg font-bold">
					Sessions and account
				</h2>
				<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
					<SignOutOfSessions />
					<DeleteData />
				</div>
			</section>
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
			className="flex flex-col gap-4"
		>
			<div>
				<h2 id="profile-heading" className="text-foreground text-lg font-bold">
					Profile
				</h2>
				<p className="text-muted-foreground text-sm">
					How you appear in GratiText.
				</p>
			</div>
			<div className="grid gap-x-4 sm:grid-cols-2">
				<Field
					labelProps={{ htmlFor: fields.name.id, children: 'Your Name' }}
					inputProps={{
						...getInputProps(fields.name, { type: 'text' }),
						autoComplete: 'name',
					}}
					errors={fields.name.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
					inputProps={{
						...getInputProps(fields.username, { type: 'text' }),
						className: 'lowercase',
						autoComplete: 'username',
					}}
					errors={fields.username.errors}
				/>
			</div>
			<div className="border-border flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
						<Icon name="phone" size="sm" aria-hidden="true" />
					</span>
					<div>
						<p className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
							Phone number
						</p>
						<p className="text-foreground text-sm font-medium">
							{data.user.phoneNumber}
						</p>
					</div>
				</div>
				<ButtonLink variant="secondary" size="sm" to="change-number">
					Edit Your Phone Number
				</ButtonLink>
			</div>
			<ErrorList errors={form.errors} id={form.errorId} />
			<div className="flex justify-end">
				<StatusButton
					type="submit"
					name="intent"
					value={profileUpdateActionIntent}
					status={
						fetcher.state !== 'idle' ? 'pending' : (form.status ?? 'idle')
					}
					variant="brand"
				>
					Save Changes
				</StatusButton>
			</div>
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
	if (!otherSessionsCount) {
		return (
			<p className="text-muted-foreground flex items-center gap-2 text-sm">
				<Icon name="check" size="sm" aria-hidden="true" />
				This is your only active session.
			</p>
		)
	}
	return (
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
				<Icon name="exit">
					{dc.doubleCheck
						? `Are you sure?`
						: `Sign out of ${otherSessionsCount} other ${otherSessionsCount === 1 ? 'session' : 'sessions'}`}
				</Icon>
			</StatusButton>
		</fetcher.Form>
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
				className={
					dc.doubleCheck
						? undefined
						: 'text-foreground-destructive hover:bg-destructive/10'
				}
			>
				<Icon name="trash">
					{dc.doubleCheck
						? `Are you sure? This cannot be undone`
						: `Delete Account`}
				</Icon>
			</StatusButton>
		</fetcher.Form>
	)
}
