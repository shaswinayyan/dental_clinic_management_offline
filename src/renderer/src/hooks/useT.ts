/**
 * useT — returns Ant Design theme tokens that automatically switch
 * between light and dark mode. Use instead of hardcoded hex colours.
 */
import { theme } from 'antd'

export function useT() {
  const { token } = theme.useToken()
  return {
    bg:          token.colorBgContainer,       // white / dark-card
    bgLayout:    token.colorBgLayout,           // light-grey / very-dark
    bgElevated:  token.colorBgElevated,         // white / slightly lighter dark
    bgFill:      token.colorFillAlter,          // #f8fafc / dark-fill
    border:      token.colorBorderSecondary,    // #e2e8f0 / dark-border
    text:        token.colorText,               // #1e293b / near-white
    textSub:     token.colorTextSecondary,      // #64748b / muted
    textHint:    token.colorTextTertiary,       // #94a3b8 / dim
    primary:     token.colorPrimary,            // #2563eb always
    success:     token.colorSuccess,
    warning:     token.colorWarning,
    error:       token.colorError,
    radius:      token.borderRadius,
    shadow:      token.boxShadow,
  }
}
