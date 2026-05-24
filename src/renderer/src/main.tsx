import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antTheme } from 'antd'
import App from './App'
import './styles/globals.css'
import { ThemeProvider, useTheme } from './context/ThemeContext'

function ThemedApp() {
  const { isDark } = useTheme()

  const themeConfig = {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563eb',
      colorBgLayout: isDark ? '#0f172a' : '#f1f5f9',
      borderRadius: 8,
      borderRadiusLG: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: 14,
      colorBorderSecondary: isDark ? '#334155' : '#e2e8f0',
      colorTextSecondary: isDark ? '#94a3b8' : '#64748b',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.10)'
    },
    components: {
      Layout: { siderBg: isDark ? '#1e293b' : '#ffffff' },
      Card: { paddingLG: 20 },
      Table: {
        headerBg: isDark ? '#1e293b' : '#f8fafc',
        headerColor: isDark ? '#94a3b8' : '#64748b',
        rowHoverBg: isDark ? '#1e293b' : '#f8fafc'
      },
      Button: { borderRadius: 8 },
      Input: { borderRadius: 8 },
      Select: { borderRadius: 8 },
      Tag: { borderRadius: 6 }
    }
  }

  return (
    <ConfigProvider theme={themeConfig}>
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </React.StrictMode>
)
