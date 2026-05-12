import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useWallet } from '../../context/WalletContext'
import { getNFTs, isValidSolanaAddress, getConnection } from '../../lib/solana'
import { getLocal, setLocal } from '../../lib/storage'
import type { NFTAsset } from '../../types/nft'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

async function fetchNFTMeta(mint: string): Promise<NFTAsset | null> {
  try {
    const metadataPda = await import('@solana/web3.js').then(({ PublicKey }) => {
      const METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM.toBuffer(), new PublicKey(mint).toBuffer()],
        METADATA_PROGRAM
      )
      return pda
    })
    return { mint, name: `NFT (${mint.slice(0, 6)}...)`, image: '', description: `Mint: ${mint}` }
  } catch {
    return null
  }
}

export default function NFTsScreen() {
  const { account, network } = useWallet()
  const [chainNFTs, setChainNFTs] = useState<NFTAsset[]>([])
  const [customNFTs, setCustomNFTs] = useState<NFTAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<NFTAsset | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [mintInput, setMintInput] = useState('')
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  const loadCustomNFTs = useCallback(async () => {
    const stored = await getLocal('customNFTs')
    setCustomNFTs(stored ?? [])
  }, [])

  useEffect(() => {
    if (!account?.publicKey) return
    setIsLoading(true)
    Promise.all([
      getNFTs(account.publicKey, network),
      loadCustomNFTs(),
    ]).then(([result]) => {
      setChainNFTs(result)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [account?.publicKey, network, loadCustomNFTs])

  async function handleImport() {
    setImportError('')
    if (!isValidSolanaAddress(mintInput.trim())) {
      return setImportError('Invalid Solana mint address')
    }
    const mint = mintInput.trim()
    const already = customNFTs.some(n => n.mint === mint) || chainNFTs.some(n => n.mint === mint)
    if (already) return setImportError('This NFT is already in your gallery')

    setIsImporting(true)
    try {
      const conn = getConnection(network)
      const info = await conn.getParsedAccountInfo(new PublicKey(mint))
      const parsed = (info.value?.data as any)?.parsed
      const isNFTMint =
        parsed?.info?.decimals === 0 &&
        (parsed?.info?.supply === '1' || parsed?.info?.supply === 1)
      if (info.value && !isNFTMint) {
        setImportError('This address does not appear to be an NFT mint')
        setIsImporting(false)
        return
      }

      const nft: NFTAsset = {
        mint,
        name: `NFT (${mint.slice(0, 8)}...)`,
        image: '',
      }

      const updated = [...customNFTs, nft]
      setCustomNFTs(updated)
      await setLocal('customNFTs', updated)
      setShowImport(false)
      setMintInput('')
    } catch (e: any) {
      setImportError(e?.message ?? 'Failed to import NFT')
    } finally {
      setIsImporting(false)
    }
  }

  async function removeCustomNFT(mint: string) {
    const updated = customNFTs.filter(n => n.mint !== mint)
    setCustomNFTs(updated)
    await setLocal('customNFTs', updated)
  }

  const allNFTs = [...chainNFTs, ...customNFTs]

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">NFTs</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setShowImport(true); setMintInput(''); setImportError('') }}
            className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center font-bold text-lg"
          >+</motion.button>
        </div>

        {isLoading ? (
          <div className="flex justify-center mt-10"><Spinner /></div>
        ) : allNFTs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 text-[var(--color-text)]/50">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="text-sm">No NFTs found</p>
            <p className="text-xs opacity-50 text-center px-6">NFTs held in this wallet will appear here, or tap + to import by mint address</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {allNFTs.map((nft, i) => {
              const isCustom = customNFTs.some(n => n.mint === nft.mint)
              return (
                <motion.div
                  key={nft.mint}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="card-bg rounded-2xl overflow-hidden text-left relative"
                >
                  <button className="w-full text-left" onClick={() => setSelected(nft)}>
                    {nft.image ? (
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="w-full aspect-square object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-full aspect-square bg-[var(--color-border)] flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-semibold truncate">{nft.name}</p>
                      {nft.collection && <p className="text-[10px] opacity-40 truncate">{nft.collection}</p>}
                      {isCustom && <p className="text-[9px] opacity-30">Imported</p>}
                    </div>
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => removeCustomNFT(nft.mint)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="absolute inset-0 bg-black/60 flex items-end z-50" onClick={() => setSelected(null)}>
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full card-bg rounded-t-3xl p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            {selected.image && (
              <img src={selected.image} alt={selected.name} className="w-full max-h-48 object-contain rounded-2xl" />
            )}
            <h3 className="text-base font-bold">{selected.name}</h3>
            {selected.collection && <p className="text-xs opacity-50">{selected.collection}</p>}
            {selected.description && <p className="text-xs opacity-60">{selected.description}</p>}
            <p className="text-[10px] font-mono opacity-30 break-all">{selected.mint}</p>
            <button onClick={() => setSelected(null)} className="text-xs text-primary mt-1">Close</button>
          </motion.div>
        </div>
      )}

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import NFT by Mint">
        <div className="flex flex-col gap-3">
          <p className="text-xs opacity-50">Enter the NFT mint address to add it to your gallery</p>
          <Input
            label="Mint Address"
            placeholder="e.g. EPjFWdd5..."
            value={mintInput}
            onChange={e => { setMintInput(e.target.value); setImportError('') }}
            error={importError}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
          />
          <Button fullWidth isLoading={isImporting} onClick={handleImport}>Import NFT</Button>
        </div>
      </Modal>

      <BottomNav />
    </div>
  )
}
