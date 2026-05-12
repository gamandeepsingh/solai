import React from 'react'
import ReactDOM from 'react-dom/client'
import Popup from './Popup'
import '../styles/globals.css'
import { initAnalytics } from '../lib/analytics'

initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
)
