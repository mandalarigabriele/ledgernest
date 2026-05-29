'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon from '@/components/shared/Icon'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [status, router])

  async function handleGoogleSignIn() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0d1117',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        padding: '48px',
        background: '#161b22',
        borderRadius: '16px',
        border: '1px solid #30363d',
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px',
              background: 'linear-gradient(135deg, #1a2332, #1e2d40)',
              borderRadius: '12px',
              border: '1px solid #30363d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name="logo" size={24} />
            </div>
            <div>
              <div style={{ color: '#e6edf3', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                LedgerNest
              </div>
              <div style={{ color: '#8b949e', fontSize: '13px' }}>Personale</div>
            </div>
          </div>
          <div style={{ color: '#8b949e', fontSize: '14px', marginTop: 4 }}>
            Accedi per continuare
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            borderRadius: '8px',
            color: '#f85149',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            {error === 'AccessDenied'
              ? 'Il tuo account non è autorizzato ad accedere.'
              : 'Si è verificato un errore. Riprova.'}
          </div>
        )}

        {/* Google Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading || status === 'loading'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '12px 20px',
            background: loading ? '#21262d' : '#21262d',
            border: '1px solid #30363d',
            borderRadius: '10px',
            color: '#e6edf3',
            fontSize: '15px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.15s',
          }}
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {loading ? 'Accesso in corso…' : 'Accedi con Google'}
        </button>
      </div>
    </div>
  )
}
