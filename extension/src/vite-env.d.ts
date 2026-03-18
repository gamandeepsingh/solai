/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_COINGECKO_API_KEY: string
  readonly VITE_JUP_API_KEY: string
  readonly VITE_RPC_MAINNET: string
  readonly VITE_RPC_DEVNET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
