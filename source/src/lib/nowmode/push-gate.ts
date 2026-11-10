/**
 * Remote push stays off until a Firebase or APNs config file is part of the build.
 * Plans are never sent. The channel is only for later app news.
 */
export function pushShouldStart(nativeBuild: boolean, configPresent: boolean): boolean {
  return nativeBuild && configPresent;
}
