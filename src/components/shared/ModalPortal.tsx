'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders a modal overlay directly into <body>.
 *
 * Page-level modals live inside <main class="ledgernest-page">, a scroll container that on
 * iOS Safari forms its own stacking context: the sidebar and topbar then paint above the
 * overlay whatever its z-index. Portaling to <body> puts every modal at the top level.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}
