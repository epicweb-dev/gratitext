import { useCallback, useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query, re-rendering when it flips. Reports `false` on
 * the server and during hydration, then the real value on the client.
 */
export function useMediaQuery(query: string) {
	const subscribe = useCallback(
		(onChange: () => void) => {
			const media = window.matchMedia(query)
			media.addEventListener('change', onChange)
			return () => media.removeEventListener('change', onChange)
		},
		[query],
	)
	const getSnapshot = useCallback(
		() => window.matchMedia(query).matches,
		[query],
	)
	return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
