import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { publicKey, timestamp, signature } = req.body
    if (!publicKey || !timestamp || !signature) {
      res.status(400).json({ error: 'Missing fields' }); return
    }

    const age = Date.now() - Number(timestamp)
    if (age > 5 * 60 * 1000) { res.status(400).json({ error: 'Timestamp expired' }); return }

    const message = new TextEncoder().encode(`solai-auth-${timestamp}`)
    const sig = bs58.decode(signature)
    const pubKeyBytes = bs58.decode(publicKey)

    const valid = nacl.sign.detached.verify(message, sig, pubKeyBytes)
    if (!valid) { res.status(401).json({ error: 'Invalid signature' }); return }

    const token = jwt.sign({ publicKey }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    res.json({ token })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
