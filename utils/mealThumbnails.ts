import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const FOLDER = 'meal-thumbs';

/**
 * On a device the thumbnails are files rather than part of the log. A few
 * kilobytes each sounds harmless, but AsyncStorage holds the whole log in one
 * value and Android caps it at 6 MB by default -- a year of meals would crowd
 * out the symptoms and medication sharing that space.
 *
 * Web has no filesystem to write to, so there the picture is inlined as a data
 * uri instead. That does land in the stored log, which is why the web copy is
 * rendered smaller.
 */
function thumbsDir() {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

/** Whether a thumbnail is written to disk rather than carried in the log. */
export function usesFileStorage() {
  return Platform.OS !== 'web';
}

/** Returns the stored uri, or null when it could not be kept. */
export function saveMealThumbnail(base64: string): string | null {
  if (!base64) return null;
  if (!usesFileStorage()) return `data:image/jpeg;base64,${base64}`;

  try {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const target = new File(thumbsDir(), name);
    target.create();
    target.write(base64, { encoding: 'base64' });
    return target.uri;
  } catch {
    // A missing thumbnail costs nothing; the meal itself still saves.
    return null;
  }
}

export function deleteMealThumbnail(uri?: string) {
  // An inlined thumbnail goes with the entry it lives in; there is no file.
  if (!uri || !usesFileStorage() || uri.startsWith('data:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or never written.
  }
}

/** Removes every stored thumbnail. Used by the developer reset. */
export function clearMealThumbnails() {
  if (!usesFileStorage()) return;
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing stored yet, or already removed.
  }
}
