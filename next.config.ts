import type { NextConfig } from "next";
const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.themealdb.com",
        pathname: "/images/media/meals/**",
      },
    ],
  },
};
export default config;
