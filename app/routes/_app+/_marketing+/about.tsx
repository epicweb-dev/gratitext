import { Link, type MetaFunction } from 'react-router'
import { ProsePage, ProseSection } from '#app/components/prose-page.tsx'
import { Icon } from '#app/components/ui/icon.tsx'

export const meta: MetaFunction = () => [
	{ title: 'About | GratiText' },
	{
		name: 'description',
		content:
			'Why gratitude matters, and how GratiText helps you build a habit of thanking the people you love.',
	},
]

const gratitudeBenefits = [
	{
		title: 'Improves Mental Health',
		description:
			'Expressing gratitude can significantly enhance psychological well-being. It can reduce stress, anxiety, and depression by shifting focus from negative thoughts to positive ones.',
	},
	{
		title: 'Enhances Physical Health',
		description:
			'Grateful people often experience better physical health. They tend to exercise more, have fewer aches and pains, and sleep better, contributing to overall well-being.',
	},
	{
		title: 'Strengthens Relationships',
		description:
			'Showing appreciation and thanking others can strengthen social bonds. It fosters a sense of connection and can deepen relationships by making others feel valued and appreciated.',
	},
]

const faqItems = [
	{
		question:
			'How can practicing gratitude improve my mental and physical health?',
		answer:
			'Gratitude helps you focus on what is going well, which can reduce stress and negative thought patterns. Over time, this shift in mindset supports better emotional balance and can encourage healthier habits like rest and exercise.',
	},
	{
		question:
			'What are some effective ways to incorporate gratitude into my daily routine?',
		answer:
			'Try keeping a short daily gratitude journal, sending a quick thank-you text, or pausing each morning to note three things you appreciate. Small, consistent moments make the habit stick.',
	},
	{
		question:
			'How can I maintain a sense of gratitude during challenging times or difficult situations?',
		answer:
			'Maintaining a sense of gratitude during challenging times can be difficult but is achievable with conscious effort and certain strategies. Here are some tips to help you cultivate gratitude even during tough situations:',
		details: [
			'Focus on Small Positives: Even in difficult times, there are often small positive moments or aspects you can appreciate. This could be a kind gesture from a friend, a moment of laughter, or simply the beauty of nature around you. Keeping a daily gratitude journal where you note these small positives can help.',
			'Mindfulness and Meditation: Practices such as mindfulness and meditation can help center your thoughts and allow you to find peace in the present moment. This can make it easier to identify things you are grateful for, even amidst chaos or stress.',
			'Reframe the Situation: Try to reframe your perspective on the challenging situation. Look for lessons or personal growth opportunities that may come from it. This does not mean ignoring the difficulty but rather finding a silver lining or something valuable you can take away from the experience.',
		],
		defaultOpen: true,
	},
]

export default function AboutRoute() {
	return (
		<ProsePage
			eyebrow="About GratiText"
			title="Create and nurture lasting bonds with the people you love"
			intro="GratiText helps you express gratitude with thoughtful messages to the people who matter most. Here is why gratitude matters, and how the app makes the habit stick."
		>
			<ProseSection id="why-gratitude" title="Why practice gratitude?">
				<p>
					Practicing gratitude and thanking others offers real benefits, both
					for you and for the people around you.
				</p>
				<ol className="mt-4 grid gap-4 sm:grid-cols-3">
					{gratitudeBenefits.map((benefit, index) => (
						<li
							key={benefit.title}
							className="border-border bg-card flex flex-col gap-2 rounded-[24px] border p-5 shadow-sm"
						>
							<span className="bg-brand text-brand-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
								{index + 1}
							</span>
							<h3 className="text-foreground font-semibold">{benefit.title}</h3>
							<p className="text-sm leading-relaxed">{benefit.description}</p>
						</li>
					))}
				</ol>
			</ProseSection>

			<ProseSection id="how-it-works" title="How GratiText fits in">
				<p>
					You write short notes of thanks for each person, in your own words.
					GratiText keeps them in a queue and texts one out on the schedule you
					pick, so your appreciation shows up reliably even on the busiest
					weeks.
				</p>
				<p>
					<Link to="/#how-it-works">See how it works</Link> or{' '}
					<Link to="/signup">start your free trial</Link>.
				</p>
			</ProseSection>

			<ProseSection id="faq" title="Frequently asked questions">
				<div className="space-y-3">
					{faqItems.map((item) => (
						<details
							key={item.question}
							open={item.defaultOpen}
							className="group border-border bg-card rounded-2xl border px-5 py-4 shadow-sm"
						>
							<summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
								<span>{item.question}</span>
								<Icon
									name="chevron-down"
									size="sm"
									aria-hidden="true"
									className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
								/>
							</summary>
							<div className="mt-3 space-y-3 text-sm">
								<p className="leading-relaxed">{item.answer}</p>
								{item.details ? (
									<ol className="list-decimal space-y-2 pl-5">
										{item.details.map((detail) => (
											<li key={detail} className="leading-relaxed">
												{detail}
											</li>
										))}
									</ol>
								) : null}
							</div>
						</details>
					))}
				</div>
			</ProseSection>

			<ProseSection id="contact" title="Questions or feedback?">
				<p>
					Visit the <Link to="/support">support page</Link> or email us at{' '}
					<a href="mailto:support@gratitext.app">support@gratitext.app</a>. We
					read every message.
				</p>
			</ProseSection>
		</ProsePage>
	)
}
