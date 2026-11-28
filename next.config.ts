import type { NextConfig } from 'next';

const appHostname = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['mongoose', '@aws-sdk/client-s3'],
  allowedDevOrigins: [
    '**.run.app',
    '**.us-west1.run.app',
    '**.googleusercontent.com',
    'localhost',
    '127.0.0.1',
    ...(appHostname ? [appHostname] : []),
  ],
};

export default nextConfig;
