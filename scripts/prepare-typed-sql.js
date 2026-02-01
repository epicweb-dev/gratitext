import path from 'node:path'
import fs from 'node:fs/promises'

const sourceDir = path.resolve(process.cwd(), 'prisma/sql-source')
const outputDir = path.resolve(process.cwd(), 'prisma/sql-generated')

function toCamelCase(name) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
		throw new Error(`Invalid kebab-case filename: ${name}`)
	}
	return name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase())
}

function isValidIdentifier(name) {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}

async function main() {
	await fs.rm(outputDir, { recursive: true, force: true })
	await fs.mkdir(outputDir, { recursive: true })

	const entries = await fs.readdir(sourceDir, { withFileTypes: true })
	const sqlFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
		.map((entry) => entry.name)

	for (const fileName of sqlFiles) {
		const { name } = path.parse(fileName)
		const targetName = toCamelCase(name)
		if (!isValidIdentifier(targetName)) {
			throw new Error(`Generated name "${targetName}" is not a valid identifier`)
		}
		const sourcePath = path.join(sourceDir, fileName)
		const targetPath = path.join(outputDir, `${targetName}.sql`)
		const contents = await fs.readFile(sourcePath, 'utf8')
		await fs.writeFile(targetPath, contents)
	}
}

main().catch((error) => {
	console.error('Failed to prepare typed SQL:', error)
	process.exitCode = 1
})
