import { faker } from '@faker-js/faker'
import { prisma } from '#app/utils/db.server.ts'
import {
	cleanupDb,
	createMessage,
	createPassword,
	createRecipient,
	createUser,
} from '#tests/db-utils.ts'

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	await cleanupDb(prisma)
	console.timeEnd('🧹 Cleaned up the database...')

	console.time('📱 Creating Source Number')
	await prisma.sourceNumber.create({
		data: { phoneNumber: '555-555-5555' },
		select: { id: true },
	})
	console.timeEnd('📱 Creating Source Number')

	console.time('🔑 Created permissions...')
	const entities = ['user', 'recipient', 'message']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const

	let permissionsToCreate = []
	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				permissionsToCreate.push({ entity, action, access })
			}
		}
	}
	await prisma.permission.createMany({ data: permissionsToCreate })
	console.timeEnd('🔑 Created permissions...')

	console.time('👑 Created roles...')
	await prisma.role.create({
		data: {
			name: 'admin',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'any' },
				}),
			},
		},
	})
	await prisma.role.create({
		data: {
			name: 'user',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'own' },
				}),
			},
		},
	})
	console.timeEnd('👑 Created roles...')

	const totalUsers = 5
	console.time(`👤 Created ${totalUsers} users...`)

	for (let index = 0; index < totalUsers; index++) {
		const userData = createUser()
		await prisma.user
			.create({
				select: { id: true },
				data: {
					...userData,
					password: { create: createPassword(userData.username) },
					roles: { connect: { name: 'user' } },
					// TODO: Add recipients etc.
					recipients: {
						create: Array.from(
							{ length: faker.number.int({ min: 1, max: 3 }) },
							() => ({
								...createRecipient(),
								messages: {
									create: Array.from(
										{ length: faker.number.int({ min: 1, max: 3 }) },
										() => ({ ...createMessage() }),
									),
								},
							}),
						),
					},
				},
			})
			.catch(e => {
				console.error('Error creating a user:', e)
				return null
			})
	}
	console.timeEnd(`👤 Created ${totalUsers} users...`)

	console.time(`🐨 Created admin user "kody"`)

	await prisma.user.create({
		select: { id: true },
		data: {
			username: 'kody',
			name: 'Kody',
			phoneNumber: '555-555-5639',
			password: { create: createPassword('kodylovesyou') },
			roles: { connect: [{ name: 'admin' }, { name: 'user' }] },
			recipients: {
				create: [
					{
						name: 'Hannah',
						phoneNumber: '555-555-5465',
						verified: true,
						scheduleCron: '00 00 15 * * 1-5',
						timezone: 'America/Denver',
						messages: {
							create: [
								// past messages
								{
									content: 'Hey Hannah, I think you are great',
									order: 1,
									sentAt: new Date('2024-05-30'),
								},
								{
									content: 'You are amazing and I am so grateful for you',
									order: 2,
									sentAt: new Date('2023-08-10'),
								},
								{
									content: 'You look stunning today',
									order: 3,
									sentAt: new Date('2023-07-15'),
								},
								{
									content: 'Thank you for being such a wonderful friend',
									order: 4,
									sentAt: new Date('2023-06-20'),
								},
								{
									content: 'I am so lucky to have you in my life',
									order: 5,
									sentAt: new Date('2023-05-10'),
								},
								{
									content: 'You are a true inspiration',
									order: 6,
									sentAt: new Date('2023-04-01'),
								},
								{
									content: 'I am so grateful for the joy you bring to my life',
									order: 7,
									sentAt: new Date('2023-03-15'),
								},
								{
									content: 'You are a shining star',
									order: 8,
									sentAt: new Date('2023-02-05'),
								},
								{
									content: 'You are a gift to me and to the world',
									order: 9,
									sentAt: new Date('2023-01-10'),
								},
								{
									content: 'I am so grateful for your presence in my life',
									order: 10,
									sentAt: new Date('2022-12-25'),
								},

								// future messages
								{ content: 'I love you', order: 11 },
								{ content: 'You are amazing', order: 12 },
								{ content: 'I am so grateful for you', order: 13 },
								{ content: 'You are a true friend', order: 14 },
							],
						},
					},
					{
						name: 'Marty',
						phoneNumber: '+17035551212',
						verified: true,
						scheduleCron: '00 00 08 * * *',
						timezone: 'America/Denver',
						messages: {
							create: [
								{
									content: 'Happy birthday!',
									order: 1,
									sentAt: new Date('2023-03-16'),
								},
								{
									content: 'I hope you have a wonderful day',
									order: 2,
									sentAt: new Date('2023-03-10'),
								},
								{
									content: 'I wish you all the best',
									order: 3,
									sentAt: new Date('2023-03-04'),
								},
								{
									content: 'You are loved',
									order: 4,
									sentAt: new Date('2023-02-20'),
								},
								{
									content: 'Thank you for being such a great friend',
									order: 5,
									sentAt: new Date('2023-02-14'),
								},
								{
									content: 'I appreciate everything you do',
									order: 6,
									sentAt: new Date('2023-02-07'),
								},
								{
									content: 'You are an amazing person',
									order: 7,
									sentAt: new Date('2023-01-31'),
								},
								{ content: 'You are loved', order: 8 },
								{ content: 'You are amazing', order: 9 },
								{ content: 'You are a true friend', order: 10 },
							],
						},
					},
				],
			},
		},
	})
	console.timeEnd(`🐨 Created admin user "kody"`)

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

// we're ok to import from the test directory in this file
/*
eslint
	no-restricted-imports: "off",
*/
