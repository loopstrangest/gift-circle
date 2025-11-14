import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/rooms/[code]/export": ["./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
