import { createFileRoute } from "@tanstack/react-router";
import { SITE_CONFIG } from "@/utilities/site-config";

const routes = ["/", "/docs", "/docs/security", "/docs/deployment", "/docs/local-setup"];

export const Route = createFileRoute("/sitemap/xml")({
  loader: () => {
    const baseUrl = SITE_CONFIG.siteUrl.replace(/\/$/, "");
    const lastmod = new Date().toISOString();

    const urlEntries = routes
      .map((path) => {
        const loc = `${baseUrl}${path}`;
        const priority = path === "/" ? "1.0" : path.startsWith("/docs") ? "0.7" : "0.5";
        const changefreq = path === "/" ? "weekly" : "monthly";

        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
      })
      .join("\n");

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

    return {
      body,
      contentType: "application/xml; charset=utf-8",
    };
  },
});
