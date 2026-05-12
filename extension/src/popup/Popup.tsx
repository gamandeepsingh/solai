import { useEffect, useRef, useState } from 'react'
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import CommandPalette from '../components/ui/CommandPalette'
import ChangelogModal from '../components/ui/ChangelogModal'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider, useWallet } from '../context/WalletContext'
import { AIProvider } from '../context/AIContext'
import { ToastProvider } from '../components/ui/Toast'
import OnboardingWelcome from '../screens/Onboarding/Welcome'
import OnboardingCreate from '../screens/Onboarding/CreateWallet'
import OnboardingConfirm from '../screens/Onboarding/MnemonicConfirm'
import OnboardingImport from '../screens/Onboarding/ImportWallet'
import OnboardingLedger from '../screens/Onboarding/ConnectLedger'
import HomeScreen from '../screens/Home'
import SendScreen from '../screens/Send'
import SwapScreen from '../screens/Swap'
import ReceiveScreen from '../screens/Receive'
import ContactsScreen from '../screens/Contacts'
import HistoryScreen from '../screens/History'
import AIChatScreen from '../screens/AIChat'
import SettingsScreen from '../screens/Settings'
import OrdersScreen from '../screens/Orders'
import AboutScreen from '../screens/About'
import LockScreen from '../screens/LockScreen'
import NFTsScreen from '../screens/NFTs'
import TokenDetailScreen from '../screens/TokenDetail'
import ExploreScreen from '../screens/Explore'
import DAppApprovalScreen from '../screens/DAppApproval'
import ConnectedAppsScreen from '../screens/ConnectedApps'
import SignApprovalScreen from '../screens/SignApproval'
import AgentWalletsScreen from '../screens/AgentWallets'
import BatchSendScreen from '../screens/BatchSend'
import WatchlistScreen from '../screens/Watchlist'
import AllowanceApprovalScreen from '../screens/AllowanceApproval'
import { track, identifyWallet } from '../lib/analytics'

function RouteTracker() {
  const location = useLocation()
  useEffect(() => {
    track('page_view', { path: location.pathname })
  }, [location.pathname])
  return null
}

const _params = new URLSearchParams(window.location.search)
const isDAppApproval = _params.get('page') === 'dapp-approval'
const isSignApproval = _params.get('page') === 'sign-approval'
const isAllowanceRequest = _params.get('page') === 'allowance-request'
const signApprovalRequestId = _params.get('requestId') ?? ''
const allowanceRequestId = _params.get('requestId') ?? ''

function AppRoutes() {
  const { init, isLoading, isLocked, account, lock } = useWallet()
  const [initialized, setInitialized] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [inactivityDaysLeft, setInactivityDaysLeft] = useState<number | null>(null)
  // Set to true when sign was completed (approve or reject) so beforeunload
  // doesn't also send a cancel.
  const signCompletedRef = useRef(false)
  // Pre-loaded pending sign data so the beforeunload handler can use tabId
  // synchronously (chrome.storage is async and can't be awaited in beforeunload).
  const pendingSignRef = useRef<any>(null)

  useEffect(() => {
    init().then(() => setInitialized(true))
  }, [])

  useEffect(() => {
    if (account?.publicKey) identifyWallet(account.publicKey)
  }, [account?.publicKey])

  useEffect(() => {
    if (!initialized) return
    // Import dynamically to avoid circular deps
    import('../lib/storage').then(({ getLocal }) => {
      getLocal('inactivityGuard').then(g => {
        if (!g?.enabled || !g.lastActivityAt) return
        const daysSince = (Date.now() - g.lastActivityAt) / 86_400_000
        const daysLeft = Math.ceil(g.inactivityDays - daysSince)
        if (daysLeft <= 7 && daysLeft >= 0) setInactivityDaysLeft(daysLeft)
      })
    })
  }, [initialized])

  // Pre-load pending sign data as soon as the popup is ready.
  useEffect(() => {
    if (!isSignApproval || !initialized) return
    chrome.storage.session.get(`pendingSign_${signApprovalRequestId}`).then((stored: any) => {
      pendingSignRef.current = stored[`pendingSign_${signApprovalRequestId}`]
    })
  }, [initialized])

  // If the user closes the sign-approval popup without approving or rejecting,
  // send a rejection back to the dApp tab.
  useEffect(() => {
    if (!isSignApproval || !initialized) return
    const cancelHandler = () => {
      if (signCompletedRef.current) return
      const pending = pendingSignRef.current
      if (pending?.tabId != null) {
        chrome.tabs.sendMessage(pending.tabId, {
          type: 'SOLAI_SIGN_RESULT',
          requestId: signApprovalRequestId,
          error: 'User rejected the request',
        }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', cancelHandler)
    return () => window.removeEventListener('beforeunload', cancelHandler)
  }, [initialized])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if (mod && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o) }
      if (mod && e.key === 'l' && !inInput) { e.preventDefault(); lock() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lock])

  if (!initialized || isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!account) {
    return (
      <Routes>
        <Route path="/" element={<OnboardingWelcome />} />
        <Route path="/create" element={<OnboardingCreate />} />
        <Route path="/confirm" element={<OnboardingConfirm />} />
        <Route path="/import" element={<OnboardingImport />} />
        <Route path="/ledger-connect" element={<OnboardingLedger />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // Sign-approval popup: unlock first if needed, then show the approval screen.
  if (isSignApproval) {
    if (isLocked) {
      // LockScreen — after unlock, isLocked flips to false and React re-renders
      // straight into the SignApprovalScreen branch below.
      return (
        <Routes>
          <Route path="*" element={<LockScreen signMode />} />
        </Routes>
      )
    }
    return (
      <SignApprovalScreen
        requestId={signApprovalRequestId}
        onDone={() => { signCompletedRef.current = true }}
      />
    )
  }

  if (isLocked) {
    return (
      <Routes>
        <Route path="*" element={<LockScreen />} />
      </Routes>
    )
  }

  // Connect approval popup opened by service worker
  if (isDAppApproval) {
    return <DAppApprovalScreen />
  }

  if (isAllowanceRequest) {
    return (
      <div className="w-[360px] h-[600px] overflow-hidden relative bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
        <AllowanceApprovalScreen requestId={allowanceRequestId} />
      </div>
    )
  }

  return (
    <>
      {inactivityDaysLeft !== null && (
        <div className={`absolute top-0 left-0 right-0 z-40 px-4 py-2.5 flex items-center gap-2 text-xs font-medium ${inactivityDaysLeft <= 3 ? 'bg-red-500' : 'bg-yellow-500'} text-black`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="flex-1">Auto-sweep in <strong>{inactivityDaysLeft} day{inactivityDaysLeft !== 1 ? 's' : ''}</strong></span>
          <button
            onClick={() => {
              import('../lib/storage').then(({ getLocal, setLocal }) => {
                getLocal('inactivityGuard').then(g => {
                  if (!g) return
                  setLocal('inactivityGuard', { ...g, lastActivityAt: Date.now(), pendingSweep: false })
                  setInactivityDaysLeft(null)
                })
              })
            }}
            className="underline font-semibold"
          >
            Reset timer
          </button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/send" element={<SendScreen />} />
        <Route path="/swap" element={<SwapScreen />} />
        <Route path="/receive" element={<ReceiveScreen />} />
        <Route path="/contacts" element={<ContactsScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/ai" element={<AIChatScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/nfts" element={<NFTsScreen />} />
        <Route path="/token" element={<TokenDetailScreen />} />
        <Route path="/explore" element={<ExploreScreen />} />
        <Route path="/about" element={<AboutScreen />} />
        <Route path="/connected-apps" element={<ConnectedAppsScreen />} />
        <Route path="/agent-wallets" element={<AgentWalletsScreen />} />
        <Route path="/batch-send" element={<BatchSendScreen />} />
        <Route path="/watchlist" element={<WatchlistScreen />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <AnimatePresence>
        {cmdOpen && <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

export default function Popup() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <MemoryRouter>
          <RouteTracker />
          <div className="w-[360px] h-[600px] overflow-hidden relative bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
            <ToastProvider>
              <AIProvider>
                <AppRoutes />
                <ChangelogModal />
              </AIProvider>
            </ToastProvider>
          </div>
        </MemoryRouter>
      </WalletProvider>
    </ThemeProvider>
  )
}
