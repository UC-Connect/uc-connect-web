import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admissions knowledge base is read from disk at request time by the chat API.
  outputFileTracingIncludes: {
    "/api/admissions/chat": ["./content/admissions/**/*"],
  },
};

export default nextConfig;
