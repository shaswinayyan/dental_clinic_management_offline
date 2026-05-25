import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@vorsa/types', '@vorsa/validators'],
}

export default nextConfig
