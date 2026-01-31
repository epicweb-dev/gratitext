// This module should contain type definitions for modules which do not have
// their own type definitions and are not available on DefinitelyTyped.

// declare module 'some-untyped-pkg' {
// 	export function foo(): void;
// }

declare module 'virtual:react-router/server-build' {
	import { type ServerBuild } from 'react-router'

	const build: ServerBuild
	export = build
}
