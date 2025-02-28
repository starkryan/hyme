"use client";

export function WebsiteStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "OTPMaya",
          "url": "https://otpmaya.com",
          "description": "Virtual number service for SMS verification",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://otpmaya.com/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        })
      }}
    />
  );
}

export function OrganizationStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "OTPMaya",
          "url": "https://otpmaya.com",
          "logo": "https://otpmaya.com/logo.png",
          "sameAs": [
            "https://twitter.com/otpmaya",
            "https://facebook.com/otpmaya",
            "https://instagram.com/otpmaya"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+1-800-123-4567",
            "contactType": "customer service",
            "availableLanguage": ["English"]
          }
        })
      }}
    />
  );
}

export function ServiceStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Virtual Phone Number for SMS Verification",
          "provider": {
            "@type": "Organization",
            "name": "OTPMaya"
          },
          "serviceType": "SMS Verification",
          "description": "Get instant, secure, and reliable virtual phone numbers for SMS verification. OTPMaya provides automated OTP reception services worldwide.",
          "offers": {
            "@type": "Offer",
            "price": "0.50",
            "priceCurrency": "USD",
            "priceValidUntil": "2025-12-31",
            "availability": "https://schema.org/InStock"
          }
        })
      }}
    />
  );
}

export function FAQStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is OTPMaya?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "OTPMaya is a service that provides virtual phone numbers for SMS verification. Our service allows you to receive one-time passwords and verification codes without exposing your personal phone number."
              }
            },
            {
              "@type": "Question",
              "name": "How does OTPMaya work?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "OTPMaya provides you with temporary virtual phone numbers that can receive SMS messages. When you need to verify an account or service, use our virtual number instead of your personal one. All verification codes and messages will be displayed in your OTPMaya dashboard."
              }
            },
            {
              "@type": "Question",
              "name": "Is OTPMaya legal?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, OTPMaya is a legal service that provides virtual numbers for legitimate purposes such as testing applications, protecting privacy, and creating accounts for services in different regions."
              }
            }
          ]
        })
      }}
    />
  );
} 