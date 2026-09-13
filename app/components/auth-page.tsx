import { type ReactNode } from 'react'

export function AuthPage({
	title,
	description,
	children,
	footer,
}: {
	title: string
	description?: ReactNode
	children: ReactNode
	footer?: ReactNode
}) {
	return (
		<main className="container flex flex-1 flex-col items-center justify-center py-12 md:py-20">
			<div className="w-full max-w-lg">
				<div className="text-center">
					<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
						GratiText
					</p>
					<h1 className="text-foreground mt-3 font-serif text-3xl font-semibold text-balance sm:text-4xl">
						{title}
					</h1>
					{description ? (
						<p className="text-muted-foreground mt-3 text-base text-pretty">
							{description}
						</p>
					) : null}
				</div>
				<div className="border-border bg-card mt-8 rounded-[32px] border px-6 py-8 shadow-sm sm:px-8">
					{children}
				</div>
				{footer ? (
					<div className="text-muted-foreground [&_a]:text-foreground mt-6 text-center text-sm [&_a]:font-semibold [&_a]:underline-offset-4 hover:[&_a]:underline">
						{footer}
					</div>
				) : null}
			</div>
		</main>
	)
}
