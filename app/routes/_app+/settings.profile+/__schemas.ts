import { z } from 'zod'
import { NameSchema, PhoneNumberSchema } from '#app/utils/user-validation.ts'

export const updateNameActionIntent = 'update-name'
export const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
export const deleteDataActionIntent = 'delete-data'

export const UpdateNameSchema = z.object({ name: NameSchema })

export const ChangeNumberSchema = z.object({
	countryCode: z.string().optional(),
	phoneNumber: PhoneNumberSchema,
})
