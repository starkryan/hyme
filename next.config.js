/** @type {import('next').NextConfig} */

const nextConfig = {
  /* config options here */
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Image optimization
  images: {
    domains: ['otpmaya.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Improve SEO with trailing slashes consistency
  trailingSlash: false,
  
  // Enable HTTP/2 for improved performance
  experimental: {
    // Enable server components compression for better performance
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Improve page speed with compression
  compress: true,
  
  // Powering performance
  poweredByHeader: false,
};

module.exports = nextConfig; 