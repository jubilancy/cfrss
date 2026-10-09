# Future add-ons (bucket list)

Ideas for this fork. Nothing here is started unless it says so.
Base URL plan: **rss.glosse.me**.

## Next up: tags and folders, part 2

Tags, folders and public feeds are built (see Done). What is left:

- **Folders and tags in the sidebar tree**, next to the feeds and categories,
  so they can be reached without opening the Library page.
- **Rule-based folders.** Folders that fill themselves from rules, such as
  **"everything from feed X"**. Rules could also match a tag, a keyword, or a
  category. Hand-added folders stay as they are.
- **More from public feeds:** a short note on the tag or folder page about who
  can see it, and optionally a nicer human-readable view of the feed when it is
  opened in a browser.

## Domain and URLs

- **Custom domain: rss.glosse.me.** Needs glosse.me in the same Cloudflare
  account. Then add the route in `wrangler.toml` so it survives redeploys.
- **RSS reader URL template.** A setting for the reader's address pattern,
  where `%s` is replaced with the feed URL. For example
  `https://rss.glosse.me/subscribe/%s`. Handy for "subscribe in my reader"
  links, browser extensions and bookmarklets.
  (Wording from the original note: "rss reader URL template: use %s for URL
  variable". Exact behaviour to be decided.)
- **Feeds as an API for the main site.** Public JSON feeds from tags and
  folders (see above), displayed on the main site.

## Reading and saving

- **Save-a-URL bookmarklet (Instapaper-style read-later).** Save any page,
  reader view, highlights and tags. Reuses the reader's existing article
  extraction.
- **Full-text search** across all articles.
- **Keyboard shortcuts** for fast reading: next, previous, star, mark read.
  (A good reference for the feel is ratatoskr, the livedoor Reader clone.)
- **Real web fonts and a reading font-size control.** The current serif is a
  system font, so it varies by device.
- **Email or push delivery of the daily digest.**
- **Faster feed refresh.** Currently hourly, 10 feeds per run, because of the
  free plan's CPU limit.

## Languages

- **More article translation targets.** The translator offers the targets in
  `src/utils/translate-languages.ts` (Chinese is one of them). Add more
  languages there and in the translation dropdown.
- **More interface languages.** The interface is English-only. `i18n.ts` is
  structured so extra dictionaries can be added later.
- **English text-to-speech test sentence.** The "test" button still reads a
  Chinese sentence aloud.

## Housekeeping

- **Swap `public/icons/logo.svg` for the sun.** It is still the sparkle logo.
  The web app manifest and a browser `mask-icon` setting point at it. Needs an
  SVG or PNG of the sun.
- **Manifest theme color.** Still the old blue; the interface is now terracotta.

- **Working preview builds.** Previews have no app JavaScript, so they show a
  blank page. Fix: in the Worker's Settings, Builds, set the Build command to
  `npm run build:client`.
- **Update the CI workflow's Node version.** GitHub warns Node 20 is
  deprecated for the checkout and setup-node actions.
- **Auto-delete merged branches.** Repo Settings, General, Pull Requests,
  "Automatically delete head branches".

## Setup to-do (not code)

- Import feeds from an old reader (OPML) or paste feed URLs.
- Add an LLM key in settings for summaries, translation and the daily digest.
- Connect a GitHub repository in settings for full-text reading and offline
  caching.
- Add the custom domain in the Worker's Settings, Domains & Routes.
- Sponsor the original creator: https://github.com/ituff

## Bigger projects (separate from this fork)

- **Your own RSS reader from scratch**, on Cloudflare Workers, D1 and cron.
- **Instapaper alternative.** Shares fetch and extraction code with the reader,
  so the two could live on one Worker. Needs R2 enabled for images.
- **Thunderbit-style AI scraper.** Cloudflare Browser Rendering plus an LLM to
  pick fields, crawl and paginate, with export to sheets and databases. The
  hard part is anti-bot handling, which needs paid proxies.
- **Google Reader API compatibility**, so other reader apps can sync with this
  one (konpeito does this).

## Done

- **Clean slash URLs** instead of `#/`: `/articles`, `/feed/:id`,
  `/category/:id`, `/library`, `/tag/cooking`, `/TBR`. Old `#/` links
  still work.
- **Tags and folders** on individual articles, an Organize panel in the reader,
  a Library page, and tag and folder pages. Hand-added folders only. Folder
  names stay off app paths such as `/settings`.
- **Public feeds** for any tag or folder: `/tag/cooking/feed.xml`,
  `/tag/cooking/feed.json`, `/TBR/feed.xml`, `/TBR/feed.json`. Private by
  default, a switch on each page turns one on. Title, link, date, author and a
  short excerpt only.
- **Feed and app icons** use the uploaded sun art; feeds carry it as their
  channel image.
- Working previews for every branch (the Worker config builds the browser
  bundle itself).

- English-only interface (Chinese stays as an article translation target).
- Magazine-style redesign: warm palette, serif headlines, roomier cards.
- Default category renamed to "Uncategorized".
- Cloudflare deploy config for this fork.
