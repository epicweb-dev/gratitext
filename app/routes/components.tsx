import { Link } from '@remix-run/react'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.js'

export default function Components() {
	return (
		<div className="container">
			<h1 className="my-8 text-h1">
				<Link to="/" className="underline">
					GratiText
				</Link>{' '}
				Components
			</h1>
			<div className="light flex flex-col gap-10 p-10">
				<Buttons />
			</div>
			<div className="dark flex flex-col gap-10 bg-background p-10 text-foreground">
				<Buttons />
			</div>
		</div>
	)
}

function Buttons() {
	return (
		<div className="flex flex-col gap-4">
			<h2 className="mb-4 text-h2">Buttons</h2>
			<div className="flex flex-col gap-4">
				<h3 className="text-h3">Variants</h3>
				<div className="flex flex-wrap gap-6">
					<Button>Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="destructive">Destructive</Button>
					<Button variant="link">Link</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="ghost">Ghost</Button>
				</div>
			</div>
			<div className="flex flex-col gap-4">
				<h3 className="text-h3">Sizes</h3>
				<div className="flex flex-wrap gap-6">
					<Button size="sm">Small</Button>
					<Button>Default</Button>
					<Button size="lg">Large</Button>
					<Button size="wide">Wide</Button>
					<Button size="pill">Pill</Button>
					<Button size="icon">
						<Icon name="camera" />
					</Button>
				</div>
			</div>
		</div>
	)
}
