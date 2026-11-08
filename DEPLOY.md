# Spark v5 — share for feedback

This folder is a static site. Open `index.html` locally, or drop the whole folder on a static host.

## Fastest public URL (your free account)

1. **Netlify Drop** — go to https://app.netlify.com/drop , drag this folder (or `spark-web.zip`). You get a `*.netlify.app` URL. Same site can be updated by dragging again (or connecting a repo later for a stable name).
2. **GitHub Pages** — create a public repo, upload these files, enable Pages on the default branch. URL stays `https://<you>.github.io/<repo>/` on every push.
3. **Cloudflare Pages** — free account, direct upload or Git. Stable project URL on redeploy.

## What not to expect from this box

Surge / Vercel / Netlify CLI and GitHub Pages from automation need *your* login. Cursor Origin hosts private/internal code repos, not a public web app. Temporary tunnels (cloudflared quick tunnel) give a URL that dies when the process stops.

## Tester notes

- Data stays in each person’s browser (`localStorage`).
- On phones: Safari/Chrome → Share / menu → **Add to Home Screen** (manifest + icons included).
- Drawer → **Send feedback** copies text or opens mail with a blank To: field.
