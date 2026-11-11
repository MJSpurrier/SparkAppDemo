# Now Mode on Android and iOS

The website at `https://mjspurrier.github.io/SparkAppDemo/` stays a hash-routed Pages app with base `/SparkAppDemo/` and the service worker. The Android and iOS projects live in `source/android` and `source/ios`. They load a separate build whose base is `./` and which does not register the service worker.

Plans stay in `localStorage` under `nowmode-v1`. Installing the native app does not read the browser's storage, and opening the website does not wipe the app. Nothing in this setup resets that key.

A brand-new phone install starts empty: no sample tasks, board notes, wins, reminders, or history. The GitHub Pages build still includes the demo day so a tester can look around. If `nowmode-v1` is already on the device, it is migrated and left in place.

## Account screen

The first launch, before the tutorial, asks for an email, a name, and a username. The name and username are saved in the existing profile, and Today greets with the name. The email stays in that same on-device profile. There is no server call.

The form talks to an `AuthProvider` in `source/src/lib/nowmode/auth.ts`. The current provider, `createDeviceAuth`, only stores the account on the device. A real account needs a backend plugged into that same interface: Supabase email auth (magic link or password) and, after that, cloud sync. Until that provider exists, closing the app does not create a login anywhere else, and a new phone does not see the old one. Do not tell store reviewers that people can sign in across devices yet.

App id: `com.nowmode.planner`. App name: Now Mode. Version: `1.0.0` in `source/package.json`, `source/src/lib/nowmode/version.ts`, `source/public/version.json`, the Android `versionName`, and the iOS marketing version. Bump them together.

## Scripts

From `source/`:

```sh
npm install
npm test
npm run build          # GitHub Pages bundle in dist/
npm run build:native   # phone bundle in dist-native/
npm run cap:sync       # rebuild the phone bundle and copy it into both projects
npm run cap:android    # sync, then open Android Studio
npm run cap:ios        # sync, then open Xcode (Mac only)
```

`open:android` and `open:ios` open the native projects without rebuilding.

Icons and splash screens come from `source/resources/icon-source.png` (the neon brain). The generated full-bleed square is `icon-only.png`, the adaptive foreground is `icon-foreground.png`, and the splash is centered on the same near-black. Regenerate them with:

```sh
node scripts/make-brand-assets.mjs
npx @capacitor/assets generate --android --ios \
  --iconBackgroundColor '#121117' --iconBackgroundColorDark '#121117' \
  --splashBackgroundColor '#121117' --splashBackgroundColorDark '#121117'
```

The five reminder tones are `source/resources/sounds/*.wav`, copied to `android/app/src/main/res/raw/` and into the iOS app bundle. An imported mp3, m4a, wav, ogg, or webm is chosen with the system file picker (Files, Downloads, Drive) and copied into app storage. On Android that copy lives in `ln_sounds/` and is attached to a notification channel named `sound_` plus the file name without its extension. On iOS the copy lives in `Library/Sounds`. Replacing the file deletes that Android channel so the next reminder uses the new audio. The file must be 1.5 MB or smaller. Latin American Spanish speech recognition uses `es-MX` because Android has no `es-419` recognizer. Spain stays `es-ES`. English uses `en-US`.

## Reminders when the app is closed

On the phone, Now Mode schedules local notifications from the same rules as the open app:

- staged reminders (day, hour, 10 minutes, start) that are still allowed
- the end of a running focus timer
- the end of a calendar block that has a length
- recurring events, because they are already written into the plan
- the daily Board review
- quiet hours, which skip a notification whose fire time falls inside them

Edits and deletes rebuild the schedule: removed items are cancelled and changed times are replaced. The horizon is 14 days and at most 48 pending notifications, soonest first, so iOS does not hit its cap. Android can hold more, but the same cap keeps both platforms predictable. While the phone is in deep idle, Android may still space exact alarms about nine minutes apart.

The first time a reminder is scheduled, Android 12+ can open **Alarms & reminders** if exact alarms are not allowed yet. Android 13+ also needs the notification permission (`POST_NOTIFICATIONS`), which **Allow notifications** in Settings and on a task requests. The website still uses the browser permission only, and a closed tab still cannot deliver a reminder.

The installed app also asks, at first use, for the microphone (speech-to-text), the camera, and photos. Each request starts with a short explanation in English, Latin American Spanish, or Spain Spanish. Saying no keeps the feature off and offers a button that opens the app's system settings. The website keeps the Web Speech API and ordinary file inputs. Android declares `RECORD_AUDIO`, `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_AUDIO`, and `READ_EXTERNAL_STORAGE` (max SDK 32). The WebView still grants `getUserMedia` only after those runtime permissions. iOS usage strings cover the microphone, speech recognition, the camera, and the photo library.

## Remote announcements

Push is compiled out until one of these files exists and you rebuild the native app:

- `source/android/app/google-services.json`
- `source/ios/App/App/GoogleService-Info.plist`

Both are gitignored. Until then the app never asks for push permission and never contacts Firebase or APNs. Push is only for later update and announcement alerts. It does not upload plans, notes, names, or photos.

When you are ready:

1. Create a Firebase project and add an Android app with id `com.nowmode.planner`. Download `google-services.json` into `source/android/app/`. The Gradle file already applies the Google services plugin when that file is present.
2. Add an iOS app with the same id. Download `GoogleService-Info.plist` into `source/ios/App/App/` and add it to the App target. In Apple Developer, turn on Push Notifications for the App ID, create an APNs key (`.p8`), and upload that key in Firebase → Cloud Messaging.
3. In Xcode, add the Push Notifications capability and Background Modes → Remote notifications.
4. Rebuild with `npm run cap:sync`. The app then asks for push permission and registers a token. Sending still requires a trusted server or the Firebase console. There is no server in this repo.

## Update banner

On open, the app fetches `https://mjspurrier.github.io/SparkAppDemo/version.json` and compares it with `1.0.0`. A newer `android`, `ios`, or shared `version` shows a localized **Update available** banner. Dismissing it hides that version until the next cold start. If the file is missing or the same version, nothing is shown. The service worker does not cache `version.json`.

Publish a new version by editing `source/public/version.json` and shipping the Pages build. Raise the number only after the store build is available, or people will see the banner before they can update.

## Privacy policy

Inside the app: menu → Privacy, route `#/privacy`.

Public page for both stores:

https://mjspurrier.github.io/SparkAppDemo/privacy.html

It says, in English, es-419, and es-ES, that plans stay on the device and nothing is collected. There is no account, no analytics, and no advertising.

## Android: debug APK, release AAB, Play Console

You need Android Studio (or the command-line SDK) and a JDK. This project targets compile SDK 36 and min SDK 24. The debug build uses the automatic debug keystore. Do not invent a release keystore inside the repo.

Debug APK, from `source/android` after `npm run cap:sync`:

```sh
./gradlew assembleDebug
```

The file is `app/build/outputs/apk/debug/app-debug.apk`. It is gitignored.

Release app bundle:

1. On your own machine, create an upload key and keep the file outside the repo:

   ```sh
   keytool -genkeypair -v -keystore "$HOME/nowmode-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Put the secrets in the environment, not in git:

   ```sh
   export NOWMODE_KEYSTORE="$HOME/nowmode-upload.jks"
   export NOWMODE_KEYSTORE_PASSWORD="…"
   export NOWMODE_KEY_ALIAS="upload"
   export NOWMODE_KEY_PASSWORD="…"
   ```

3. In `android/app/build.gradle`, locally, add a release signing config that reads those variables and set `release.signingConfig` to it. Do not commit the passwords or the `.jks`. If you lose the upload key, Play App Signing can only help if you already enrolled and still have the upload-key reset path. Treat the file as irreplaceable.

4. Build:

   ```sh
   ./gradlew bundleRelease
   ```

   Upload `app/build/outputs/bundle/release/app-release.aab`. `assembleRelease` makes an APK if a store asks for one, but Play wants the AAB.

Play Console, for a new personal account:

- Create the app, complete the content rating, data safety, and ads forms. Data safety: data is not collected and not shared. The privacy policy URL is the link above.
- Store listing: title, short description, full description, a 512×512 icon, a 1024×500 feature graphic, and at least two phone screenshots. Phone screenshots must be between 320 px and 3840 px on a side, at a 16:9 or 9:16 ratio. 1080×1920 is a safe phone size. A 7-inch and 10-inch tablet set is needed only if you ship tablet layouts.
- New personal Play accounts have to run a closed test with at least 12 testers who have opted in, for 14 days in a row, before production access can be requested. Create a closed testing track, add the testers by email, share the opt-in link, and wait out the 14 days with those 12 still opted in. Organization accounts are not under that same 14-day rule, but they still need a test track if you want one.
- This repository cannot create the Play account, accept the policies, or upload the bundle.

## iOS: Mac or Codemagic, then TestFlight

Apple builds have to be signed on macOS. This Linux checkout can generate the Xcode project. It cannot compile the `.ipa`.

On a Mac:

1. Install Xcode and CocoaPods, or use the Swift package the project already references (`CapApp-SPM`).
2. `cd source && npm install && npm run cap:sync && npm run open:ios`
3. In Signing & Capabilities, select your team. The bundle id is `com.nowmode.planner`.
4. Product → Archive, then Distribute to App Store Connect.

Codemagic, if you do not want a local Mac:

1. Connect the GitHub repo and set the workflow to the `source/ios/App` Xcode project, scheme `App`.
2. Add a build step that runs `npm ci`, `npm run build:native`, and `npx cap sync ios` from `source/` before Xcode archives.
3. Upload an App Store Connect API key and a distribution certificate in Codemagic. Do not commit them.
4. Let Codemagic publish the build to TestFlight.

App Store Connect:

- Enroll in the Apple Developer Program. That is a paid account and only you can accept it.
- Create the app with bundle id `com.nowmode.planner` and the privacy policy URL above.
- Privacy nutrition labels: Data Not Collected.
- Screenshots. Current App Store Connect asks for the 6.9-inch iPhone set (1320×2868) if the app runs on those phones. Also provide the 6.5-inch set (1284×2778 or 1242×2688) if the form still lists it. If the target stays universal, the 13-inch iPad set (2064×2752) is required too. You can set the target to iPhone only in Xcode to drop the iPad set.
- Add yourself as an internal TestFlight tester. External testers need a short Beta App Review. Production review is a separate submission.

## Tester APK

Testers install a signed APK, not a Play listing. The short guide is `docs/TESTER.md` (English and Spanish).

The tester key is separate from a future Play upload key. It lives only on the machine that created it, at `~/.nowmode/nowmode-tester.jks`, alias `nowmode-tester`. The passwords are in `~/.nowmode/keystore.env` on that same machine. Neither file is in git. Future tester APKs must be signed with this same keystore and alias, or Android will refuse to install the update over the old app. If the machine is discarded before those files are copied into GitHub secrets, the key is gone and every tester must uninstall, which deletes the plans on the phone.

`source/android/version.properties` holds `VERSION_CODE` and `VERSION_NAME`. The first tester build is `1.0.0` (versionCode 1).

GitHub Actions workflow `.github/workflows/android-tester.yml` runs when someone starts it by hand. It raises versionCode by 1 and the patch number of versionName, commits that bump, builds a signed release APK, and attaches it to a prerelease. It does nothing until these repository secrets exist (Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_BASE64`: the keystore file encoded with `base64 -w 0 nowmode-tester.jks`
- `ANDROID_KEYSTORE_PASSWORD`: the store password
- `ANDROID_KEY_ALIAS`: `nowmode-tester`
- `ANDROID_KEY_PASSWORD`: the key password

The workflow also needs permission to push the version bump and to create releases. Do not paste the passwords into the repo, the pull request, or a chat log.

## What you still have to do yourself

- A Google Play Console account, the 12-tester / 14-day closed test if the account is a new personal one, and the upload.
- An Apple Developer account, a Mac or a Codemagic project, and App Store Connect / TestFlight.
- The upload keystore and its passwords, kept off this repo.
- Firebase and the APNs key, only when you want remote announcements.
- Store listing text and the screenshot sets above. The app icon and splash in the projects are generated, but the stores want their own exported images.
