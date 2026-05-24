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
      colorPrimary: '#c9a84c',
      colorBgLayout: isDark ? '#0d1421' : '#f0f2f6',
      borderRadius: 8,
      borderRadiusLG: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: 14,
      colorBorderSecondary: isDark ? '#1e2d45' : '#e2e8f0',
      colorTextSecondary: isDark ? '#8a9ab5' : '#64748b',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.10)'
    },
    components: {
      Layout: { siderBg: '#0a1628' },
      Card: { paddingLG: 20 },
      Table: {
        headerBg: isDark ? '#111c2e' : '#fafafa',
        headerColor: isDark ? '#8a9ab5' : '#64748b',
        rowHoverBg: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'
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
