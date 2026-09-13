import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from './ui/icon.tsx'

export function ProsePage({
	eyebrow,
	title,
	intro,
	updatedAt,
	children,
}: {
	eyebrow?: string
	title: string
	intro?: ReactNode
	updatedAt?: string
	children: ReactNode
}) {
	return (
		<main className="bg-background pb-20">
			<div className="container max-w-3xl pt-8 md:pt-12">
				<Link
					to="/"
					className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-semibold transition-colors"
				>
					<Icon name="arrow-left" size="sm" aria-hidden="true" />
					Back home
				</Link>
				<header className="mt-6 space-y-4">
					{eyebrow ? (
						<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
							{eyebrow}
						</p>
					) : null}
					<h1 className="text-foreground font-serif text-4xl font-semibold text-balance md:text-5xl">
						{title}
					</h1>
					{intro ? (
						<p className="text-muted-foreground text-lg leading-relaxed text-pretty">
							{intro}
						</p>
					) : null}
					{updatedAt ? (
						<p className="text-muted-foreground text-sm">
							Last updated {updatedAt}
						</p>
					) : null}
				</header>
				<div className="mt-10 space-y-10">{children}</div>
			</div>
		</main>
	)
}

export function ProseSection({
	id,
	title,
	children,
}: {
	id: string
	title: string
	children: ReactNode
}) {
	return (
		<section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
			<h2
				id={`${id}-heading`}
				className="text-foreground text-xl font-bold md:text-2xl"
			>
				{title}
			</h2>
			<div className="text-muted-foreground [&_a]:text-foreground [&_strong]:text-foreground mt-3 space-y-3 text-base leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
				{children}
			</div>
		</section>
	)
}

export function ProseTableOfContents({
	items,
}: {
	items: Array<{ id: string; title: string }>
}) {
	return (
		<nav
			aria-label="On this page"
			className="border-border bg-card rounded-[24px] border p-5 shadow-sm"
		>
			<p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
				On this page
			</p>
			<ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
				{items.map((item, index) => (
					<li key={item.id}>
						<a
							href={`#${item.id}`}
							className="text-foreground hover:text-brand inline-flex items-baseline gap-2 font-medium transition-colors"
						>
							<span className="text-muted-foreground tabular-nums">
								{index + 1}.
							</span>
							{item.title}
						</a>
					</li>
				))}
			</ol>
		</nav>
	)
}
