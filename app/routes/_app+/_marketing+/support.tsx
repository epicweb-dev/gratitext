import { Link, type MetaFunction } from 'react-router'
import { ProsePage, ProseSection } from '#app/components/prose-page.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'

export const meta: MetaFunction = () => [
	{ title: 'Support | GratiText' },
	{
		name: 'description',
		content:
			'Get help with GratiText: answers to common questions and how to reach us.',
	},
]

const faqs = [
	{
		question: 'Why has my recipient not received any messages yet?',
		answer: (
			<>
				New recipients must confirm a verification code before messages begin.
				Open the recipient, choose <strong>Edit</strong>, and press{' '}
				<strong>Verify</strong> to send the code. Ask your recipient to share
				the code with you, then enter it to finish. Also make sure the
				recipient's schedule is not paused and that at least one message is
				waiting in their queue.
			</>
		),
	},
	{
		question: 'How do schedules work?',
		answer: (
			<>
				Each recipient has a schedule made of a day and time in their own time
				zone. When that moment arrives, the oldest message in their queue is
				sent. If the queue is empty about 30 minutes before a send, we text you
				a reminder so you can add one.
			</>
		),
	},
	{
		question: 'Can a recipient stop receiving messages?',
		answer: (
			<>
				Yes. Any recipient can reply <strong>STOP</strong> to opt out
				immediately, and <strong>START</strong> to opt back in. You can also
				pause or delete a recipient from their settings page at any time.
			</>
		),
	},
	{
		question: 'How do I change or cancel my plan?',
		answer: (
			<>
				Go to <Link to="/settings/profile/subscription">Subscription</Link> in
				your settings. From there you can pick a plan or open the billing portal
				to update your card, switch plans, or cancel. Your plan stays active
				until the end of the current billing period.
			</>
		),
	},
	{
		question: 'How do I change my phone number or password?',
		answer: (
			<>
				Both live in <Link to="/settings/profile">Settings</Link>. Changing your
				number sends a confirmation code to the new number before it takes
				effect.
			</>
		),
	},
	{
		question: 'How do I export or delete my data?',
		answer: (
			<>
				Open <Link to="/settings/profile">Settings</Link> and choose{' '}
				<strong>Download your data</strong> for a full JSON export, or{' '}
				<strong>Delete account</strong> to remove everything permanently.
			</>
		),
	},
]

export default function SupportRoute() {
	return (
		<ProsePage
			eyebrow="Help"
			title="We're here to help"
			intro="Most questions are answered below. If yours is not, send us a note and a real person will reply."
		>
			<div className="border-border bg-card flex flex-col gap-5 rounded-[28px] border p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-4">
					<span className="bg-accent text-accent-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
						<Icon name="envelope-closed" size="md" aria-hidden="true" />
					</span>
					<div>
						<p className="text-foreground text-lg font-bold">Email support</p>
						<p className="text-muted-foreground text-sm">
							We usually reply within one business day.
						</p>
					</div>
				</div>
				<Button asChild variant="brand" className="w-full sm:w-auto">
					<a href="mailto:support@gratitext.app">support@gratitext.app</a>
				</Button>
			</div>

			<section aria-labelledby="faq-heading" className="space-y-4">
				<h2
					id="faq-heading"
					className="text-foreground text-xl font-bold md:text-2xl"
				>
					Common questions
				</h2>
				<div className="space-y-3">
					{faqs.map((faq) => (
						<details
							key={faq.question}
							className="group border-border bg-card rounded-2xl border px-5 py-4 shadow-sm"
						>
							<summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
								<span>{faq.question}</span>
								<Icon
									name="chevron-down"
									size="sm"
									aria-hidden="true"
									className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
								/>
							</summary>
							<p className="text-muted-foreground [&_a]:text-foreground [&_strong]:text-foreground mt-3 text-sm leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold">
								{faq.answer}
							</p>
						</details>
					))}
				</div>
			</section>

			<ProseSection id="more" title="Learn more">
				<ul>
					<li>
						<Link to="/about">Why gratitude matters</Link> and how GratiText
						fits into a daily habit.
					</li>
					<li>
						Our <Link to="/privacy">Privacy Policy</Link> and{' '}
						<Link to="/tos">Terms of Service</Link>.
					</li>
				</ul>
			</ProseSection>
		</ProsePage>
	)
}
