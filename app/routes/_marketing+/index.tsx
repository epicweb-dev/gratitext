import { type MetaFunction } from '@remix-run/node'
import { Link } from '@remix-run/react'
import { Button } from '#app/components/ui/button.js'
import { useOptionalUser } from '#app/utils/user.js'

export const meta: MetaFunction = () => [{ title: 'GratiText' }]

export default function Index() {
	const user = useOptionalUser()
	return (
		<main className="bg-gray-100 py-12">
			<section className="container mx-auto px-4">
				<div className="mb-12">
					<h1 className="text-center text-4xl font-bold text-gray-900">
						Welcome to GratiText
					</h1>
					<p className="mt-4 text-center text-lg text-gray-700">
						Strengthen your relationships with regular personalized messages of
						love and gratitude.
					</p>
					<div className="mt-12 flex flex-col items-center gap-6 md:flex-row">
						<div className="flex flex-col items-center md:mr-6 md:w-1/2">
							<img
								src="/images/smiling-phone-flowers.jpg"
								alt="Attention grabbing visual"
								className="aspect-square w-full max-w-md rounded-lg object-cover shadow-lg"
							/>
							<p className="mt-2 text-sm text-gray-500">
								Photo by{' '}
								<a
									className="underline"
									href="https://unsplash.com/@goodfacesagency?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
								>
									Good Faces
								</a>{' '}
								on{' '}
								<a
									className="underline"
									href="https://unsplash.com/photos/a-woman-walking-down-the-street-looking-at-her-cell-phone-58xYWBSr0aQ?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
								>
									Unsplash
								</a>
							</p>
						</div>
						<div className="flex flex-col justify-between self-stretch text-body-md text-gray-700 md:mt-0 md:w-1/2">
							<div className="flex flex-col gap-2">
								<p>
									GratiText empowers you to express love and appreciation
									effortlessly.
								</p>
								<p>
									Our platform schedules and delivers personal heartfelt
									messages from you, making it easy to{' '}
									<strong>stay connected</strong> and <em>nurture</em> your most
									important relationships.
								</p>
								<p>
									Whether it's a simple thank you or a meaningful reminder of
									your affection, GratiText helps you make a{' '}
									<strong>lasting impact</strong> on the people you care about.
								</p>
							</div>
							<p className="align-baseline text-body-2xl">
								<small>
									Messages written by you... A human. <strong>Not</strong> by
									AI.
								</small>
							</p>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
					<div className="rounded-lg bg-white p-6 shadow-lg">
						<h2 className="text-2xl font-bold text-gray-800">Sign Up</h2>
						<p className="mt-4 text-gray-600">
							Create an account and start sending thoughtful messages to your
							loved ones.
						</p>
					</div>
					<div className="rounded-lg bg-white p-6 shadow-lg">
						<h2 className="text-2xl font-bold text-gray-800">
							Add a Loved One
						</h2>
						<p className="mt-4 text-gray-600">
							Add the phone number of your loved one to get started.
						</p>
					</div>
					<div className="rounded-lg bg-white p-6 shadow-lg">
						<h2 className="text-2xl font-bold text-gray-800">
							Select a Schedule
						</h2>
						<p className="mt-4 text-gray-600">
							Choose how often you want to send messages.
						</p>
					</div>
					<div className="rounded-lg bg-white p-6 shadow-lg">
						<h2 className="text-2xl font-bold text-gray-800">
							Write a Personal Message
						</h2>
						<p className="mt-4 text-gray-600">
							Craft meaningful messages that will be sent to your loved ones.
						</p>
					</div>
					<div className="rounded-lg bg-white p-6 shadow-lg">
						<h2 className="text-2xl font-bold text-gray-800">Messages Sent</h2>
						<p className="mt-4 text-gray-600">
							Our system sends your messages to your loved ones automatically on
							the schedule.
						</p>
					</div>
					<div className="rounded-lg bg-white p-6 shadow-lg">
						<h2 className="text-2xl font-bold text-gray-800">Reminders</h2>
						<p className="mt-4 text-gray-600">
							Get notified if you've not yet queued up a message for delivery.
						</p>
					</div>
				</div>
				<div className="mt-12 text-center">
					<Button asChild>
						{user ? (
							<Link to="/recipients">Your Recipients</Link>
						) : (
							<Link to="/login">Get Started</Link>
						)}
					</Button>
				</div>
			</section>
		</main>
	)
}
