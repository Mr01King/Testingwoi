
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Gunakan POST"
    });
  }

  try {
    const { url } = req.body || {};
    const target = new URL(url);

    if (!["http:", "https:"].includes(target.protocol)) {
      throw new Error("Protokol tidak diizinkan");
    }

    // Batasi domain melalui environment variable Vercel
    const allowed = (process.env.SCRAPE_ALLOWED_HOSTS || "")
      .split(",")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean);

    if (!allowed.includes(target.hostname.toLowerCase())) {
      return res.status(403).json({
        error: "Domain belum diizinkan"
      });
    }

    const response = await fetch(target.href, {
      signal: AbortSignal.timeout(12000),
      redirect: "error",
      headers: {
        "User-Agent": "Mozilla/5.0 WebScraper/1.0"
      }
    });

    if (!response.ok) {
      throw new Error("Website merespons HTTP " + response.status);
    }

    const type = response.headers.get("content-type") || "";

    if (!type.includes("text/html")) {
      throw new Error("Target bukan halaman HTML");
    }

    const html = await response.text();

    if (html.length > 2000000) {
      throw new Error("Halaman terlalu besar");
    }

    const $ = cheerio.load(html);

    const result = {
      url: target.href,
      title: $("title").first().text().trim(),
      description:
        $('meta[name="description"]').attr("content") || "",
      links: $("a[href]").map((i, el) =>
        new URL($(el).attr("href"), target).href
      ).get().slice(0, 100),
      images: $("img[src]").map((i, el) =>
        new URL($(el).attr("src"), target).href
      ).get().slice(0, 100)
    };

    return res.status(200).json(result);

  } catch (error) {
    return res.status(400).json({
      error: error.message || "Scraping gagal"
    });
  }
};

