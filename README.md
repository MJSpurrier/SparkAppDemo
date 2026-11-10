# Now Mode

Now Mode is an ADHD-friendly planner. One thing now.

Live site: https://mjspurrier.github.io/SparkAppDemo/

## Rebuild

From the repository root:

```sh
cd source && npm install && npm run build
```

Then copy the contents of `source/dist/` to the repository root (the files GitHub Pages serves): `index.html`, `assets/`, `manifest.json`, `sw.js`, `icons/`, and the other static files. Leave the root `.nojekyll` file in place so Pages does not run Jekyll.

The Vite `base` is `/SparkAppDemo/` and the app uses a hash router. Bump `CACHE` in both `source/public/sw.js` and the copied root `sw.js` together when the shell changes. The current cache is `nowmode-v7`.

Plans, notes, wins, names, and photos stay in `localStorage` under `nowmode-v1` on this device. There is no account server, no sync, and no charge. Reminders, including the Board review, only run while the app is open. A browser notification is sent only if permission was granted and the tab is in the background. Closing the app does not deliver a missed reminder later. Recurring items are reminders, not bills. Months that do not contain the chosen date are skipped, and the clock time does not shift for daylight saving.
