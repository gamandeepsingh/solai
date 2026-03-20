import { getLocal, setLocal } from './storage'
import type { Contact } from '../types/contacts'

export async function getContacts(): Promise<Contact[]> {
  return (await getLocal('contacts')) ?? []
}

export async function saveContact(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
  const contact: Contact = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  }
  const existing = await getContacts()
  await setLocal('contacts', [...existing, contact])
  return contact
}

export async function editContact(id: string, data: Partial<Omit<Contact, 'id' | 'createdAt'>>): Promise<Contact> {
  const all = await getContacts()
  const idx = all.findIndex(c => c.id === id)
  if (idx === -1) throw new Error('Contact not found')
  const updated = { ...all[idx], ...data }
  all[idx] = updated
  await setLocal('contacts', all)
  return updated
}

export async function removeContact(id: string): Promise<void> {
  const all = await getContacts()
  await setLocal('contacts', all.filter(c => c.id !== id))
}
