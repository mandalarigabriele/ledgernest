import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: '#5bc8d0',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: '#0b0f12',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 3,
            paddingBottom: 10,
            paddingLeft: 6,
            paddingRight: 6,
          }}
        >
          <div style={{ width: 5, height: 8,  background: '#5bc8d0', borderRadius: 2 }} />
          <div style={{ width: 5, height: 14, background: '#5bc8d0', borderRadius: 2 }} />
          <div style={{ width: 5, height: 10, background: '#5bc8d0', borderRadius: 2 }} />
          <div style={{ width: 5, height: 18, background: '#5bc8d0', borderRadius: 2 }} />
          <div style={{ width: 5, height: 24, background: '#5bc8d0', borderRadius: 2 }} />
        </div>
      </div>
    ),
    { width: 64, height: 64 }
  )
}
