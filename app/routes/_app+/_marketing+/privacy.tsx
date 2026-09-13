import { type MetaFunction } from 'react-router'
import {
	ProsePage,
	ProseSection,
	ProseTableOfContents,
} from '#app/components/prose-page.tsx'

export const meta: MetaFunction = () => [
	{ title: 'Privacy Policy | GratiText' },
	{
		name: 'description',
		content:
			'How GratiText collects, uses, and protects the information you and your recipients share with us.',
	},
]

const sections = [
	{ id: 'what-we-collect', title: 'What we collect' },
	{ id: 'how-we-use-it', title: 'How we use it' },
	{ id: 'text-messages', title: 'Text messages and consent' },
	{ id: 'sharing', title: 'Who we share it with' },
	{ id: 'retention', title: 'Retention and deletion' },
	{ id: 'security', title: 'Security' },
	{ id: 'your-choices', title: 'Your choices' },
	{ id: 'children', title: 'Children' },
	{ id: 'changes', title: 'Changes to this policy' },
	{ id: 'contact', title: 'Contact' },
]

export default function PrivacyRoute() {
	return (
		<ProsePage
			eyebrow="Legal"
			title="Privacy Policy"
			intro="GratiText exists to help you send kind words to the people you care about. We collect only what we need to do that, and we never sell your information."
			updatedAt="September 13, 2026"
		>
			<ProseTableOfContents items={sections} />

			<ProseSection id="what-we-collect" title="What we collect">
				<p>
					<strong>Account details.</strong> When you sign up we collect your
					phone number, a username, your name, and a password (stored only as a
					salted hash). If you turn on two-factor authentication we store the
					secret needed to verify your codes.
				</p>
				<p>
					<strong>Recipients.</strong> To deliver your notes we store the name,
					phone number, time zone, and sending schedule for each person you add.
				</p>
				<p>
					<strong>Messages.</strong> We store the messages you write, when they
					are scheduled, and when they were sent so you can review your history.
				</p>
				<p>
					<strong>Billing.</strong> Payments are processed by Stripe. We keep a
					reference to your Stripe customer record and your subscription status.
					We never see or store your full card number.
				</p>
				<p>
					<strong>Technical data.</strong> Like most services we keep standard
					server logs (such as IP address, browser type, and pages requested)
					and error reports so we can keep GratiText reliable and secure.
				</p>
			</ProseSection>

			<ProseSection id="how-we-use-it" title="How we use it">
				<ul>
					<li>
						To create and secure your account and verify your phone number.
					</li>
					<li>
						To send your messages to your recipients on the schedule you set.
					</li>
					<li>
						To remind you when a recipient has no message waiting to be sent.
					</li>
					<li>To process payments and manage your subscription.</li>
					<li>To respond to your support requests.</li>
					<li>To detect abuse and keep the service running smoothly.</li>
				</ul>
				<p>
					We do not use your messages to train AI models, build advertising
					profiles, or for any purpose other than delivering them as you asked.
				</p>
			</ProseSection>

			<ProseSection id="text-messages" title="Text messages and consent">
				<p>
					GratiText sends SMS messages through Twilio. Before we deliver your
					notes to a new recipient, we text them a one-time verification code so
					they know who is reaching out and can confirm they are happy to
					receive messages from you.
				</p>
				<p>
					Any recipient can reply <strong>STOP</strong> at any time to opt out
					of all future messages, and <strong>START</strong> to opt back in.
					Standard message and data rates from their carrier may apply.
				</p>
			</ProseSection>

			<ProseSection id="sharing" title="Who we share it with">
				<p>
					We share information only with the service providers that help us run
					GratiText, and only as needed for them to do their job:
				</p>
				<ul>
					<li>
						<strong>Twilio</strong> to deliver text messages and receive
						replies.
					</li>
					<li>
						<strong>Stripe</strong> to process payments and manage
						subscriptions.
					</li>
					<li>
						<strong>Fly.io</strong> to host the application and its database.
					</li>
					<li>
						<strong>Sentry</strong> to capture error reports so we can fix
						problems quickly.
					</li>
				</ul>
				<p>
					We may also disclose information when required by law or to protect
					the rights and safety of our users. We do not sell personal
					information.
				</p>
			</ProseSection>

			<ProseSection id="retention" title="Retention and deletion">
				<p>
					We keep your information for as long as your account is active. You
					can delete your account at any time from{' '}
					<a href="/settings/profile">your settings page</a>; doing so removes
					your account, recipients, and messages from our database. Copies in
					routine backups and logs age out on a rolling schedule after that.
				</p>
				<p>
					You can also download a copy of everything we hold about you from the
					same page.
				</p>
			</ProseSection>

			<ProseSection id="security" title="Security">
				<p>
					All traffic to GratiText is encrypted in transit. Passwords are hashed
					with bcrypt, sessions are stored in signed cookies, and access to
					production systems is limited to the people who operate the service.
					No system is perfectly secure, so please use a strong, unique password
					and consider enabling two-factor authentication.
				</p>
			</ProseSection>

			<ProseSection id="your-choices" title="Your choices">
				<ul>
					<li>
						Update your name, username, and phone number in your settings.
					</li>
					<li>Pause or delete any recipient whenever you like.</li>
					<li>
						Cancel your subscription at any time through the billing portal.
					</li>
					<li>Download or delete all of your data from your settings page.</li>
				</ul>
			</ProseSection>

			<ProseSection id="children" title="Children">
				<p>
					GratiText is not directed at children under 13, and we do not
					knowingly collect information from them. If you believe a child has
					created an account, please contact us and we will remove it.
				</p>
			</ProseSection>

			<ProseSection id="changes" title="Changes to this policy">
				<p>
					If we make meaningful changes to this policy we will update the date
					at the top of this page and, where appropriate, let you know by text
					or within the app.
				</p>
			</ProseSection>

			<ProseSection id="contact" title="Contact">
				<p>
					Questions about privacy? Email us at{' '}
					<a href="mailto:support@gratitext.app">support@gratitext.app</a> and a
					human will get back to you.
				</p>
			</ProseSection>
		</ProsePage>
	)
}
