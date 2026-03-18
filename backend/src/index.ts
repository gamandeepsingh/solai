import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB } from './lib/db'
import authRouter from './routes/auth'
import contactsRouter from './routes/contacts'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)
app.use('/contacts', contactsRouter)

app.get('/health', (_, res) => res.json({ ok: true }))

connectDB().then(() => {
  app.listen(PORT, () => console.log(`SOLAI backend running on port ${PORT}`))
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err)
  process.exit(1)
})
