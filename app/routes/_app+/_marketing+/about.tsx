import { Link, type MetaFunction } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'

export const meta: MetaFunction = () => [{ title: 'About | GratiText' }]

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
		<main className="bg-background pb-16">
			<section className="container pt-10">
				<Link
					to="/"
					className="text-body-xs text-muted-foreground inline-flex items-center gap-2"
				>
					<Icon name="arrow-left" size="sm" />
					Back Home
				</Link>
				<div className="mt-6 max-w-2xl space-y-4">
					<h1 className="text-h3 text-foreground leading-tight md:text-h2">
						Create and Nurture Lasting Bonds With Your Loved Ones
					</h1>
					<p className="text-body-sm text-muted-foreground">
						This page serves as a preview of different paragraph and text
						styles for any scenario you might need.
					</p>
				</div>
			</section>

			<section className="container mt-12" aria-labelledby="gratitude-benefits">
				<div className="max-w-3xl space-y-4">
					<h2 id="gratitude-benefits" className="text-h4 md:text-h3">
						Why Should You Practice Gratitude?
					</h2>
					<p className="text-body-sm text-muted-foreground">
						Practicing gratitude and thanking others offers numerous benefits
						for both the individual and those around them. Here are some key
						reasons why it is beneficial:
					</p>
					<ol className="space-y-5 text-body-sm text-muted-foreground">
						{gratitudeBenefits.map((benefit, index) => (
							<li key={benefit.title} className="leading-relaxed">
								<span className="font-semibold text-foreground">
									{index + 1}. {benefit.title}:{' '}
								</span>
								{benefit.description}
							</li>
						))}
					</ol>
				</div>
			</section>

			<section className="container mt-12" aria-labelledby="gratitude-faq">
				<div className="max-w-3xl space-y-6">
					<h2 id="gratitude-faq" className="text-h4 md:text-h3">
						Wondering How a Set of Questions in an FAQ Could Look?
					</h2>
					<div className="rounded-[28px] border border-border bg-muted p-4 shadow-sm sm:p-6">
						<div className="space-y-4">
							{faqItems.map((item) => (
								<details
									key={item.question}
									open={item.defaultOpen}
									className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm"
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body-sm font-semibold text-foreground">
										<span>{item.question}</span>
										<Icon
											name="chevron-down"
											size="sm"
											className="text-muted-foreground"
										/>
									</summary>
									<div className="mt-3 space-y-3 text-body-xs text-muted-foreground">
										<p className="leading-relaxed">{item.answer}</p>
										{item.details ? (
											<ol className="list-decimal space-y-2 pl-4">
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
					</div>
				</div>
			</section>

			<section className="container mt-12 pb-8">
				<div className="text-center">
					<p className="text-body-xs text-muted-foreground">
						Have Questions/Need to Report an Issue?
					</p>
					<p className="text-body-sm text-foreground">
						Contact us at{' '}
						<a
							className="font-semibold underline"
							href="mailto:support@gratitude.app"
						>
							support@gratitude.app
						</a>
					</p>
				</div>
			</section>
		</main>
	)
}
