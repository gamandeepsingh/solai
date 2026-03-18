import { useState, useEffect, useCallback } from 'react'
import { fetchContacts, createContact, updateContact, deleteContact } from '../lib/api'
import { setLocal } from '../lib/storage'
import type { Contact } from '../types/contacts'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchContacts()
      setContacts(data)
      await setLocal('contacts', data)
    } catch {}
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data: Omit<Contact, '_id' | 'createdAt'>) => {
    const contact = await createContact(data)
    setContacts(prev => [...prev, contact])
    return contact
  }, [])

  const update = useCallback(async (id: string, data: Partial<Omit<Contact, '_id' | 'createdAt'>>) => {
    const contact = await updateContact(id, data)
    setContacts(prev => prev.map(c => c._id === id ? contact : c))
    return contact
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteContact(id)
    setContacts(prev => prev.filter(c => c._id !== id))
  }, [])

  return { contacts, isLoading, add, update, remove, reload: load }
}
