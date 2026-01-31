import { useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { useDoubleCheck } from './misc.tsx'

let root: Root | null = null
let container: HTMLDivElement | null = null

const render = (ui: ReactElement) => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	root.render(ui)
}

afterEach(() => {
	root?.unmount()
	root = null
	container?.remove()
	container = null
})

function TestComponent({ safeDelayMs = 0 }: { safeDelayMs?: number }) {
	const [defaultPrevented, setDefaultPrevented] = useState<
		'idle' | 'no' | 'yes'
	>('idle')
	const dc = useDoubleCheck({ safeDelayMs })
	return (
		<div>
			<output>Default Prevented: {defaultPrevented}</output>
			<button
				{...dc.getButtonProps({
					onClick: (e) =>
						setDefaultPrevented(e.defaultPrevented ? 'yes' : 'no'),
				})}
			>
				{dc.doubleCheck ? 'You sure?' : 'Click me'}
			</button>
		</div>
	)
}

test('prevents default on the first click, and does not on the second', async () => {
	const user = userEvent.setup()
	render(<TestComponent safeDelayMs={200} />)

	const status = page.getByRole('status')
	const button = page.getByRole('button')

	await expect.element(status).toHaveTextContent('Default Prevented: idle')
	await expect.element(button).toHaveTextContent('Click me')

	await user.click(button)
	await expect.element(button).toHaveTextContent('You sure?')
	await expect.element(status).toHaveTextContent('Default Prevented: yes')
	await expect.element(button).toHaveAttribute('data-safe-delay', 'true')

	// clicking it during the safe delay does nothing
	await user.click(button)
	await expect.element(button).toHaveTextContent('You sure?')
	await expect.element(status).toHaveTextContent('Default Prevented: yes')
	await expect.element(button).toHaveAttribute('data-safe-delay', 'true')

	await expect.element(button).toHaveAttribute('data-safe-delay', 'false')

	await user.click(button)
	await expect.element(button).toHaveTextContent('You sure?')
	await expect.element(status).toHaveTextContent('Default Prevented: no')
})

test('blurring the button starts things over', async () => {
	const user = userEvent.setup()
	render(<TestComponent />)

	const status = page.getByRole('status')
	const button = page.getByRole('button')

	await user.click(button)
	await expect.element(button).toHaveTextContent('You sure?')
	await expect.element(status).toHaveTextContent('Default Prevented: yes')

	await user.click(document.body)
	// button goes back to click me
	await expect.element(button).toHaveTextContent('Click me')
	// our callback wasn't called, so the status doesn't change
	await expect.element(status).toHaveTextContent('Default Prevented: yes')
})

test('hitting "escape" on the input starts things over', async () => {
	const user = userEvent.setup()
	render(<TestComponent />)

	const status = page.getByRole('status')
	const button = page.getByRole('button')

	await user.click(button)
	await expect.element(button).toHaveTextContent('You sure?')
	await expect.element(status).toHaveTextContent('Default Prevented: yes')

	await user.keyboard('{Escape}')
	// button goes back to click me
	await expect.element(button).toHaveTextContent('Click me')
	// our callback wasn't called, so the status doesn't change
	await expect.element(status).toHaveTextContent('Default Prevented: yes')
})
