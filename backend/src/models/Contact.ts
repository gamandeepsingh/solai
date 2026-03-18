import { Schema, model } from 'mongoose'

const contactSchema = new Schema(
  {
    ownerPubkey: { type: String, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Contact = model('Contact', contactSchema)
