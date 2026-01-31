import '@vitest/browser/matchers'
import { afterEach } from 'vitest'

afterEach(() => {
	document.body.innerHTML = ''
})
