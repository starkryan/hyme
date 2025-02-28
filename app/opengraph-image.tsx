import { ImageResponse } from 'next/og';

export const alt = 'OTPMaya - Virtual Number Service for SMS Verification';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#000000',
          color: '#ffffff',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 50,
          fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif',
          backgroundImage: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          {/* Replace with your actual logo */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#0088cc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 20,
              fontSize: 40,
              fontWeight: 'bold',
            }}
          >
            OTP
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #ffffff, #aaaaaa)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            OTPMaya
          </div>
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 'normal',
            textAlign: 'center',
            maxWidth: 800,
            marginBottom: 40,
          }}
        >
          Virtual Number Service for SMS Verification
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '80%',
            marginTop: 30,
          }}
        >
          {['Instant', 'Secure', 'Reliable', 'Global'].map((feature, i) => (
            <div
              key={i}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.1)',
                fontSize: 24,
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
} 