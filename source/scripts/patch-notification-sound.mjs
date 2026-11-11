import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/@capacitor/local-notifications/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/SoundResolver.kt",
);
if (!fs.existsSync(file)) {
  console.log("sound resolver not installed");
  process.exit(0);
}
const source = fs.readFileSync(file, "utf8");
if (source.includes("nowmode-imported-sound")) {
  console.log("sound resolver already accepts imported files");
  process.exit(0);
}
const needle = `        if (resId != 0) {
            return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.packageName + "/raw/" + base)
        }

        return resolveFromAssets(context, sound)
    }`;
const insert = `        if (resId != 0) {
            return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.packageName + "/raw/" + base)
        }

        // nowmode-imported-sound: a file the person picked from Files, Downloads, or Drive.
        val imported = importedUri(context, sound)
        if (imported != null) return imported

        return resolveFromAssets(context, sound)
    }

    private fun importedUri(context: Context, sound: String): Uri? {
        val fileName = if (sound.contains("/")) sound.substring(sound.lastIndexOf('/') + 1) else sound
        val dir = File(context.getExternalFilesDir(null) ?: context.filesDir, COPY_DIR)
        val outFile = File(dir, fileName)
        if (!outFile.exists()) return null
        return try {
            FileProvider.getUriForFile(context, context.packageName + AUTHORITY_SUFFIX, outFile)
        } catch (e: IllegalArgumentException) {
            null
        }
    }`;
if (!source.includes(needle)) {
  console.error("sound resolver layout changed; imported alarms need a manual patch");
  process.exit(1);
}
fs.writeFileSync(file, source.replace(needle, insert));
console.log("sound resolver now plays imported files");
