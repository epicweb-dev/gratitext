import { type RefObject, useEffect } from 'react'

const focusableSelector = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Makes a panel behave like a modal dialog: focus moves into it when it
 * opens, Tab cycles inside it, Escape calls `onEscape`, and focus returns to
 * whatever had it before when the panel closes.
 */
export function useFocusTrap(
	panelRef: RefObject<HTMLElement | null>,
	active: boolean,
	onEscape?: () => void,
) {
	useEffect(() => {
		if (!active) return
		const panel = panelRef.current
		if (!panel) return
		const previouslyFocused =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null
		const getFocusable = () =>
			Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
				(element) => !element.hasAttribute('disabled'),
			)

		const autofocus = panel.querySelector<HTMLElement>('[autofocus]')
		;(autofocus ?? panel).focus({ preventScroll: true })

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (!onEscape) return
				event.preventDefault()
				onEscape()
				return
			}
			if (event.key !== 'Tab') return
			const focusable = getFocusable()
			if (focusable.length === 0) {
				event.preventDefault()
				return
			}
			const first = focusable[0]!
			const last = focusable[focusable.length - 1]!
			const active = document.activeElement
			const activeIndex = focusable.findIndex((element) => element === active)
			if (event.shiftKey) {
				if (activeIndex <= 0) {
					event.preventDefault()
					last.focus()
				}
			} else if (activeIndex === -1 || activeIndex === focusable.length - 1) {
				event.preventDefault()
				first.focus()
			}
		}
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('keydown', onKeyDown)
			if (previouslyFocused?.isConnected) {
				previouslyFocused.focus({ preventScroll: true })
			}
		}
	}, [active, onEscape, panelRef])
}
