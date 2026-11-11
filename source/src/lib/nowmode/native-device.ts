import { clearCustomSoundMeta, readCustomSound, writeCustomSound, AUDIO_MIME, audioExtension } from "./device-access";

export async function openAppSettings(): Promise<void> {
  const { registerPlugin } = await import("@capacitor/core");
  const DeviceSettings = registerPlugin<{ open(): Promise<void> }>("DeviceSettings");
  await DeviceSettings.open();
}

export class PhotoDenied extends Error {
  constructor() {
    super("photo-denied");
    this.name = "PhotoDenied";
  }
}

export async function photoAccess(source: "camera" | "photos"): Promise<"granted" | "prompt" | "denied"> {
  const { Camera } = await import("@capacitor/camera");
  const state = (await Camera.checkPermissions())[source];
  if (state === "granted" || state === "limited") return "granted";
  if (state === "denied") return "denied";
  return "prompt";
}

export async function takeOrChoosePhoto(source: "camera" | "photos"): Promise<string | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const state = (await Camera.requestPermissions({ permissions: [source] }))[source];
  if (state !== "granted" && state !== "limited") throw new PhotoDenied();
  try {
    const photo = await Camera.getPhoto({
      quality: 60,
      width: 640,
      resultType: CameraResultType.DataUrl,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

async function bytesFromBase64(data: string): Promise<Uint8Array> {
  const clean = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/** System document picker: Files, Downloads, Drive, and other storage apps. */
export async function pickAlarmFile(): Promise<{ name: string; type: string; bytes: Uint8Array; ext: string } | null> {
  const { FilePicker } = await import("@capawesome/capacitor-file-picker");
  let picked;
  try {
    picked = await FilePicker.pickFiles({ types: [...AUDIO_MIME], limit: 1, readData: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) return null;
    throw err;
  }
  const file = picked.files[0];
  if (!file) return null;
  const ext = audioExtension(file.name, file.mimeType);
  if (!ext || !file.data) return null;
  return { name: file.name || `custom.${ext}`, type: file.mimeType || `audio/${ext}`, bytes: await bytesFromBase64(file.data), ext };
}

/** Keep a copy where Android's notification channel and iOS Library/Sounds can play it. */
export async function storeAlarmFile(bytes: Uint8Array, ext: string): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  const { Directory, Filesystem } = await import("@capacitor/filesystem");
  const previous = readCustomSound();
  const rev = (previous?.rev ?? 0) + 1;
  const file = `custom.${ext}`;
  const data = bytesToBase64(bytes);
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    await Filesystem.writeFile({ path: `Sounds/${file}`, data, directory: Directory.Library, recursive: true });
  } else {
    await Filesystem.writeFile({ path: `ln_sounds/${file}`, data, directory: Directory.External, recursive: true });
  }
  if (previous && previous.file !== file) {
    const directory = platform === "ios" ? Directory.Library : Directory.External;
    const path = platform === "ios" ? `Sounds/${previous.file}` : `ln_sounds/${previous.file}`;
    await Filesystem.deleteFile({ path, directory }).catch(() => {});
  }
  writeCustomSound({ file, rev });
  if (platform === "android") {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.deleteChannel({ id: "sound_custom" }).catch(() => {});
  }
}

export function forgetAlarmFile() {
  clearCustomSoundMeta();
}
