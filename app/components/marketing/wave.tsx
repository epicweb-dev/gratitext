import { cn } from '#app/utils/misc.tsx'

const WIDTH = 1440
const HEIGHT = 40
const STEPS_PER_PERIOD = 24

/**
 * Sine wave from the "Transition wave" illustration. The filled area is
 * *below* the wave so the divider takes the lower section's colour via
 * `currentColor`. It overshoots the bottom edge by one unit so no hairline
 * shows between the divider and its section.
 */
function wavePath(periods: number, phase: number) {
	const amp = HEIGHT / 2 - 1
	const mid = HEIGHT / 2
	const steps = periods * STEPS_PER_PERIOD
	const points: Array<string> = []
	for (let i = 0; i <= steps; i++) {
		const x = (WIDTH / steps) * i
		const t = i / STEPS_PER_PERIOD - phase
		const y = mid - amp * Math.cos(2 * Math.PI * t)
		points.push(`${x.toFixed(1)} ${y.toFixed(2)}`)
	}
	return `M${points.join(' L')} L${WIDTH} ${HEIGHT + 1} L0 ${HEIGHT + 1} Z`
}

// The designs keep roughly the same physical scallop size on every screen,
// so phones get far fewer periods than the desktop frame. `phase` is where
// the first crest sits, as a fraction of one period.
const DESKTOP_PATH = wavePath(7, 0.185)
const MOBILE_PATH = wavePath(2.5, 0.25)

/**
 * Place inside a `relative` section. `edge="top"` draws the section colour
 * rising into the previous section; `edge="bottom"` draws it dipping into the
 * next one. The divider is raised above neighbouring sections so it is not
 * painted over by whichever section follows in the document.
 */
export function WaveEdge({
	edge,
	className,
}: {
	edge: 'top' | 'bottom'
	className?: string
}) {
	const sharedClassName = cn(
		'pointer-events-none absolute left-0 z-10 w-full overflow-visible fill-current',
		edge === 'top'
			? 'top-0 -translate-y-full'
			: 'bottom-0 translate-y-full rotate-180',
		className,
	)
	return (
		<>
			<svg
				aria-hidden="true"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				className={cn(sharedClassName, 'h-[1.875rem] md:hidden')}
			>
				<path d={MOBILE_PATH} />
			</svg>
			<svg
				aria-hidden="true"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				className={cn(sharedClassName, 'hidden h-10 md:block')}
			>
				<path d={DESKTOP_PATH} />
			</svg>
		</>
	)
}
