import { useEffect, useState } from 'react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider, useWallet } from '../context/WalletContext'
import { AIProvider } from '../context/AIContext'
import { ToastProvider } from '../components/ui/Toast'
import OnboardingWelcome from '../screens/Onboarding/Welcome'
import OnboardingCreate from '../screens/Onboarding/CreateWallet'
import OnboardingConfirm from '../screens/Onboarding/MnemonicConfirm'
import OnboardingImport from '../screens/Onboarding/ImportWallet'
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

// Detect whether this popup was opened for a dApp connection request
const isDAppApproval = new URLSearchParams(window.location.search).get('page') === 'dapp-approval'

function AppRoutes() {
  const { init, isLoading, isLocked, account } = useWallet()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    init().then(() => setInitialized(true))
  }, [])

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // When locked, always show the lock screen.
  // After unlock isLocked becomes false and we re-render — isDAppApproval
  // (derived from window.location.search) is still true so we fall through
  // to DAppApprovalScreen below instead of the normal routes.
  if (isLocked) {
    return (
      <Routes>
        <Route path="*" element={<LockScreen />} />
      </Routes>
    )
  }

  // Approval popup opened by service worker: skip the normal wallet UI
  if (isDAppApproval) {
    return <DAppApprovalScreen />
  }

  return (
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
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default function Popup() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <MemoryRouter>
          <div className="w-[360px] h-[600px] overflow-hidden relative bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
            <ToastProvider>
              <AIProvider>
                <AppRoutes />
              </AIProvider>
            </ToastProvider>
          </div>
        </MemoryRouter>
      </WalletProvider>
    </ThemeProvider>
  )
}
