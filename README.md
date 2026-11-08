# Now Mode

Now Mode is an ADHD-friendly planner. One thing now.

Live site: https://mjspurrier.github.io/SparkAppDemo/

## Rebuild

From the repository root:

```sh
cd source && npm install && npm run build
```

Then copy the contents of `source/dist/` to the repository root (the files GitHub Pages serves): `index.html`, `assets/`, `manifest.json`, `sw.js`, `icons/`, and the other static files. Leave the root `.nojekyll` file in place so Pages does not run Jekyll.

The Vite `base` is `/SparkAppDemo/` and the app uses a hash router.
