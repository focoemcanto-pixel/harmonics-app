import type { OpenNextConfig } from "open-next/types/open-next";

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      incrementalCache: "cloudflare-kv",
      tagCache: "cloudflare-kv",
      queue: "cloudflare-queue",
    },
  },
};

export default config;
