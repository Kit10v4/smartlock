/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }]
  },
  // Turbopack (Next.js 16+ default) requires string aliases
  turbopack: {
    resolveAlias: {
      "react-native-fs": "./shims/react-native-fs.js"
    }
  },
  // Webpack fallback (--webpack flag or older Next.js)
  webpack: (config) => {
    config.resolve.alias["react-native-fs"] = path.resolve(__dirname, "shims", "react-native-fs.js");
    return config;
  }
};

module.exports = nextConfig;
