import { defineConfig, passthroughImageService } from "astro/config";
import preact from "@astrojs/preact";
import mdx from "@astrojs/mdx";

// Islands are written against the React API and run on Preact (compat) —
// same code, ~10 KB runtime instead of ~67 KB.
export default defineConfig({
  site: "https://example.com", // TODO: real domain before deploy (canonical + share URLs)
  integrations: [preact({ compat: true }), mdx()],
  image: { service: passthroughImageService() },
});
