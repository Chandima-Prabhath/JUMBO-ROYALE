// Robust clipboard utility with multiple fallbacks
// Works in non-secure contexts (HTTP), older browsers, and inside iframes.

export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Try modern Clipboard API (requires secure context + user interaction)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      // fall through to fallbacks
    }
  }

  // 2. Fallback: hidden textarea + execCommand (works in non-secure contexts)
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      textarea.style.left = '-9999px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)

      // Select and copy
      const selection = document.getSelection()
      const range = document.createRange()
      range.selectNodeContents(textarea)
      selection?.removeAllRanges()
      selection?.addRange(range)
      textarea.setSelectionRange(0, textarea.value.length)

      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      selection?.removeAllRanges()
      return ok
    } catch (err) {
      // last resort below
    }
  }

  return false
}
