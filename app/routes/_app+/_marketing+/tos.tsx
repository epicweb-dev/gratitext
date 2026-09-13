import { type MetaFunction } from 'react-router'
import {
	ProsePage,
	ProseSection,
	ProseTableOfContents,
} from '#app/components/prose-page.tsx'

export const meta: MetaFunction = () => [
	{ title: 'Terms of Service | GratiText' },
	{
		name: 'description',
		content: 'The terms that govern your use of GratiText.',
	},
]

const sections = [
	{ id: 'agreement', title: 'Agreement' },
	{ id: 'your-account', title: 'Your account' },
	{ id: 'recipients', title: 'Recipients and consent' },
	{ id: 'acceptable-use', title: 'Acceptable use' },
	{ id: 'billing', title: 'Trials, subscriptions, and billing' },
	{ id: 'delivery', title: 'Message delivery' },
	{ id: 'termination', title: 'Termination' },
	{ id: 'disclaimers', title: 'Disclaimers and liability' },
	{ id: 'changes', title: 'Changes to these terms' },
	{ id: 'contact', title: 'Contact' },
]

export default function TermsOfServiceRoute() {
	return (
		<ProsePage
			eyebrow="Legal"
			title="Terms of Service"
			intro="These terms are short on purpose. They describe what you can expect from GratiText and what we ask of you in return."
			updatedAt="September 13, 2026"
		>
			<ProseTableOfContents items={sections} />

			<ProseSection id="agreement" title="Agreement">
				<p>
					By creating an account or using GratiText you agree to these terms and
					to our <a href="/privacy">Privacy Policy</a>. If you do not agree,
					please do not use the service.
				</p>
			</ProseSection>

			<ProseSection id="your-account" title="Your account">
				<ul>
					<li>You must be at least 18 years old to create an account.</li>
					<li>
						You must provide a phone number you control and keep your login
						details private. You are responsible for activity that happens under
						your account.
					</li>
					<li>
						Let us know right away at{' '}
						<a href="mailto:support@gratitext.app">support@gratitext.app</a> if
						you think your account has been compromised.
					</li>
				</ul>
			</ProseSection>

			<ProseSection id="recipients" title="Recipients and consent">
				<p>
					GratiText sends text messages on your behalf, so you are the sender of
					every message. You agree that:
				</p>
				<ul>
					<li>
						You only add people who know you and would welcome messages from
						you.
					</li>
					<li>
						New recipients confirm a verification code before your messages
						begin, and you will respect their choice if they decline.
					</li>
					<li>
						If a recipient replies STOP, their number is opted out and you will
						not attempt to reach them through GratiText again unless they opt
						back in.
					</li>
				</ul>
			</ProseSection>

			<ProseSection id="acceptable-use" title="Acceptable use">
				<p>
					GratiText is for gratitude and encouragement. You may not use it to:
				</p>
				<ul>
					<li>Send marketing, solicitations, or bulk messages of any kind.</li>
					<li>Harass, threaten, deceive, or impersonate anyone.</li>
					<li>Send content that is unlawful, hateful, or sexually explicit.</li>
					<li>Probe, disrupt, or reverse-engineer the service.</li>
				</ul>
				<p>
					We may remove content or suspend accounts that violate these rules.
				</p>
			</ProseSection>

			<ProseSection id="billing" title="Trials, subscriptions, and billing">
				<ul>
					<li>
						New accounts get a free trial. You will not be charged until you
						choose a plan.
					</li>
					<li>
						Plans are billed monthly in advance through Stripe. Prices are shown
						on our <a href="/#pricing">pricing section</a> and may change with
						notice before your next billing period.
					</li>
					<li>
						You can cancel at any time from the billing portal in your settings.
						Your plan stays active until the end of the period you have already
						paid for.
					</li>
					<li>
						Plan limits (such as how many messages can be sent per day) apply as
						described on the pricing page.
					</li>
				</ul>
			</ProseSection>

			<ProseSection id="delivery" title="Message delivery">
				<p>
					We work hard to deliver every message at the moment you scheduled it,
					but text delivery ultimately depends on mobile carriers and networks
					we do not control. Messages may occasionally be delayed or
					undeliverable, and GratiText should not be relied on for urgent or
					emergency communication.
				</p>
			</ProseSection>

			<ProseSection id="termination" title="Termination">
				<p>
					You can delete your account whenever you like from your settings page.
					We may suspend or terminate accounts that violate these terms or
					create risk for other users. When an account is closed, scheduled
					messages will no longer be sent.
				</p>
			</ProseSection>

			<ProseSection id="disclaimers" title="Disclaimers and liability">
				<p>
					GratiText is provided "as is" without warranties of any kind. To the
					fullest extent permitted by law, GratiText and the people who build it
					are not liable for indirect, incidental, or consequential damages, and
					our total liability for any claim is limited to the amount you paid us
					in the twelve months before the claim arose.
				</p>
			</ProseSection>

			<ProseSection id="changes" title="Changes to these terms">
				<p>
					We may update these terms from time to time. When we do, we will
					change the date at the top of this page and, for significant changes,
					let you know by text or within the app. Continuing to use GratiText
					after a change means you accept the updated terms.
				</p>
			</ProseSection>

			<ProseSection id="contact" title="Contact">
				<p>
					Questions about these terms? Email{' '}
					<a href="mailto:support@gratitext.app">support@gratitext.app</a>.
				</p>
			</ProseSection>
		</ProsePage>
	)
}
