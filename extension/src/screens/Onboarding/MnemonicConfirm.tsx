import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import FadeIn from '../../components/animations/FadeIn'
import { useWallet } from '../../context/WalletContext'

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export default function MnemonicConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { importWallet } = useWallet()

  const mnemonic: string = (location.state as any)?.mnemonic ?? ''
  const password: string = (location.state as any)?.password ?? ''
  const words = useMemo(() => mnemonic.split(' '), [mnemonic])
  const indices = useMemo(() => shuffle([0,1,2,3,4,5,6,7,8,9,10,11]).slice(0, 3).sort((a, b) => a - b), [])
  const options = useMemo(() => indices.map(i => shuffle([words[i], ...shuffle(words.filter((_, j) => j !== i)).slice(0, 2)])), [indices, words])

  const [selected, setSelected] = useState<(string | null)[]>(indices.map(() => null))
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!mnemonic || !password) { navigate('/'); return null }

  function handleSelect(qIndex: number, word: string) {
    setSelected(prev => { const next = [...prev]; next[qIndex] = word; return next })
    setError('')
  }

  async function verify() {
    const correct = indices.every((wordIndex, qi) => selected[qi] === words[wordIndex])
    if (!correct) { setError('Incorrect — try again'); return }

    setIsLoading(true)
    try {
      await importWallet(mnemonic, password)
      navigate('/home')
    } catch (e: any) {
      setError(e.message ?? 'Failed to create wallet')
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col px-5 pt-5 pb-4 bg-[var(--color-bg)]">
      <FadeIn>
        <button onClick={() => navigate(-1)} className="text-sm opacity-50 mb-4">← Back</button>
        <h2 className="text-xl font-bold mb-1">Verify Phrase</h2>
        <p className="text-xs opacity-50 mb-6">Select the correct word for each position</p>
        <div className="flex flex-col gap-5 mb-6">
          {indices.map((wordIndex, qi) => (
            <div key={qi}>
              <p className="text-xs opacity-50 mb-2">Word #{wordIndex + 1}</p>
              <div className="flex gap-2">
                {options[qi].map(option => (
                  <motion.button
                    key={option}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelect(qi, option)}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-medium border transition-colors ${
                      selected[qi] === option
                        ? 'bg-primary text-black border-primary'
                        : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text)]'
                    }`}
                  >
                    {option}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <Button fullWidth isLoading={isLoading} onClick={verify} disabled={selected.some(s => s === null)}>
          Confirm & Create Wallet
        </Button>
      </FadeIn>
    </div>
  )
}
