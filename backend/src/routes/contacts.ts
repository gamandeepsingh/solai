import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { Contact } from '../models/Contact'

const router = Router()

router.use(requireAuth)

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contacts = await Contact.find({ ownerPubkey: req.publicKey }).sort({ createdAt: -1 })
    res.json(contacts)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, address, note } = req.body
    if (!name || !address) { res.status(400).json({ error: 'Name and address required' }); return }
    const contact = await Contact.create({ ownerPubkey: req.publicKey, name, address, note: note ?? '' })
    res.status(201).json(contact)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, ownerPubkey: req.publicKey },
      { $set: req.body },
      { new: true }
    )
    if (!contact) { res.status(404).json({ error: 'Not found' }); return }
    res.json(contact)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Contact.findOneAndDelete({ _id: req.params.id, ownerPubkey: req.publicKey })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
