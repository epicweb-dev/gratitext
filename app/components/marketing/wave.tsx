import { cn } from '#app/utils/misc.tsx'

const WIDTH = 1440
const HEIGHT = 40
const PERIODS = 7

/**
 * Smooth sinusoidal scallop from the "Transition wave" illustration. The
 * filled area is *below* the wave so the divider takes the lower section's
 * colour via `currentColor`.
 */
function wavePath() {
	const period = WIDTH / PERIODS
	const amp = HEIGHT / 2 - 2
	const mid = HEIGHT / 2
	let d = `M0 ${mid}`
	for (let i = 0; i < PERIODS; i++) {
		const x = i * period
		// two cubic segments per period approximate a sine wave
		d += ` C${x + period * 0.18} ${mid - amp * 1.35} ${x + period * 0.32} ${mid - amp * 1.35} ${x + period * 0.5} ${mid}`
		d += ` C${x + period * 0.68} ${mid + amp * 1.35} ${x + period * 0.82} ${mid + amp * 1.35} ${x + period} ${mid}`
	}
	d += ` L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`
	return d
}

const PATH = wavePath()

/**
 * Place inside a `relative` section. `edge="top"` draws the section colour
 * rising into the previous section; `edge="bottom"` draws it dipping into the
 * next one.
 */
export function WaveEdge({
	edge,
	className,
}: {
	edge: 'top' | 'bottom'
	className?: string
}) {
	return (
		<svg
			aria-hidden="true"
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			preserveAspectRatio="none"
			className={cn(
				'pointer-events-none absolute left-0 h-6 w-full fill-current sm:h-8 md:h-10',
				edge === 'top' ? 'top-0 -translate-y-full' : 'bottom-0 translate-y-full rotate-180',
				className,
			)}
		>
			<path d={PATH} />
		</svg>
	)
}
