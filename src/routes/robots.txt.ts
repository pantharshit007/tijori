import { createFileRoute } from "@tanstack/react-router";
import { SITE_CONFIG } from "@/utilities/site-config";

export const Route = createFileRoute("/robots/txt")({
  loader: () => {
    const baseUrl = SITE_CONFIG.siteUrl.replace(/\/$/, "");
    const body = `User-agent: *\nAllow: /\nDisallow: /d/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
    return {
      body,
      contentType: "text/plain; charset=utf-8",
      status: 200,
    };
  },
});
