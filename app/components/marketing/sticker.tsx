import { type ReactNode } from 'react'
import { cn } from '#app/utils/misc.tsx'

/**
 * Scalloped "flower" sticker from the landing page illustrations: a ring of
 * overlapping lobes drawn in one colour behind rotated display text.
 */
export function FlowerSticker({
	lobes = 7,
	rotate = -10,
	className,
	shapeClassName,
	children,
}: {
	lobes?: number
	rotate?: number
	className?: string
	shapeClassName?: string
	children: ReactNode
}) {
	const r = 50
	// lobes sit on a ring and touch their neighbours so the gaps read as petals
	const orbit = 30
	const lobeRadius = Math.min(r - orbit, orbit * Math.sin(Math.PI / lobes) * 1.18)
	const circles = Array.from({ length: lobes }, (_, i) => {
		const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2
		return {
			cx: r + Math.cos(angle) * orbit,
			cy: r + Math.sin(angle) * orbit,
		}
	})
	return (
		<div
			aria-hidden="true"
			className={cn('relative aspect-square select-none', className)}
		>
			<svg
				viewBox="0 0 100 100"
				className={cn('absolute inset-0 h-full w-full', shapeClassName)}
			>
				<circle cx={r} cy={r} r={orbit + lobeRadius * 0.2} />
				{circles.map((c, i) => (
					<circle key={i} cx={c.cx} cy={c.cy} r={lobeRadius} />
				))}
			</svg>
			<div
				className="font-display absolute inset-0 flex flex-col items-center justify-center text-center leading-[1.05]"
				style={{ transform: `rotate(${rotate}deg)` }}
			>
				{children}
			</div>
		</div>
	)
}
