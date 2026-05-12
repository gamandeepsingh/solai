import { useState, useEffect, useCallback } from 'react'
import { getContacts, saveContact, editContact, removeContact } from '../lib/contacts'
import type { Contact } from '../types/contacts'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setContacts(await getContacts())
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data: Omit<Contact, 'id' | 'createdAt'>) => {
    const contact = await saveContact(data)
    setContacts(prev => [...prev, contact])
    return contact
  }, [])

  const update = useCallback(async (id: string, data: Partial<Omit<Contact, 'id' | 'createdAt'>>) => {
    const contact = await editContact(id, data)
    setContacts(prev => prev.map(c => c.id === id ? contact : c))
    return contact
  }, [])

  const remove = useCallback(async (id: string) => {
    await removeContact(id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }, [])

  return { contacts, isLoading, add, update, remove, reload: load }
}
