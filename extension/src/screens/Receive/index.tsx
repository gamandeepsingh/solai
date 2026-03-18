import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import CopyButton from '../../components/ui/CopyButton'
import FadeIn from '../../components/animations/FadeIn'
import { useWallet } from '../../context/WalletContext'

export default function ReceiveScreen() {
  const { account } = useWallet()
  const navigate = useNavigate()
  const address = account?.publicKey ?? ''

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 pb-16">
        <FadeIn className="flex flex-col items-center gap-5 w-full">
          <div>
            <h2 className="text-xl font-bold text-center mb-1">Receive</h2>
            <p className="text-xs opacity-40 text-center">Share your address to receive SOL or tokens</p>
          </div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-3xl card-bg"
          >
            <QRCodeSVG
              value={address}
              size={180}
              bgColor="transparent"
              fgColor="#ABFF7A"
              level="M"
            />
          </motion.div>
          <div className="w-full card-bg rounded-2xl p-4">
            <p className="text-[10px] opacity-40 mb-1.5">Your Solana Address</p>
            <p className="text-xs font-mono break-all leading-relaxed opacity-80">{address}</p>
            <div className="mt-3 flex justify-end">
              <CopyButton text={address} />
            </div>
          </div>
        </FadeIn>
      </div>
      <BottomNav />
    </div>
  )
}
