# Future add-ons (bucket list)

Ideas for this fork. Nothing here is started unless it says so.
Base URL plan: **rss.glosse.me**.

## Next up: tags and folders

Built in stages, each one a small change that can be looked at before it
goes live.

1. **Clean slash URLs, no `?operators` and no `#`.**
   - Tags: `rss.glosse.me/tag/cooking`
   - Folders: `rss.glosse.me/TBR`
   - Switch the router from hash (`#/`) to path routing. The Worker already
     serves the app for unknown paths.
   - Reserve names that belong to the app (`settings`, `tag`, `api`, `feed`,
     `bookmarks`, `digest`, `subscriptions`, ...) so a folder can't take one.
2. **Tags and folders on individual articles.**
   - Folders are hand-curated lists (TBR, Read later, Recipes).
   - Tags are stackable labels (cooking, rust, politics).
   - Categories stay as they are, grouping subscriptions.
   - Start with **hand-added folders only**.
3. **Public feeds for every tag and folder.**
   - Slash-style: `/tag/cooking/feed.xml` and `/TBR/feed.xml`.
   - JSON versions for the main site: `/tag/cooking.json` and `/TBR.json`.
   - Each tag or folder is **private by default**, with a public switch.
   - Public feeds carry title, link, source and a short excerpt, not full
     article text.
   - Send CORS headers on the JSON endpoints so a main site can call them.

### Later: rule-based folders

- Folders that fill themselves from rules, such as **"everything from feed X"**.
  Rules could also match a tag, a keyword, or a category.

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

- English-only interface (Chinese stays as an article translation target).
- Magazine-style redesign: warm palette, serif headlines, roomier cards.
- Default category renamed to "Uncategorized".
- Cloudflare deploy config for this fork.
