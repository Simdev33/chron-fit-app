import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const FOLDER = 'meal-thumbs';

/**
 * Thumbnails live as files rather than inside the log. A few kilobytes each
 * sounds harmless, but AsyncStorage holds the whole log in one value and
 * Android caps it at 6 MB by default -- a year of meals would crowd out the
 * symptoms and medication sharing that space. Web has no persistent
 * filesystem here, so there the picture is simply not kept.
 */
function thumbsDir() {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

export function canStoreThumbnails() {
  return Platform.OS !== 'web';
}

/** Returns the stored uri, or null when it could not be kept. */
export function saveMealThumbnail(base64: string): string | null {
  if (!canStoreThumbnails() || !base64) return null;

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
  if (!uri || !canStoreThumbnails()) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or never written.
  }
}

/** Removes every stored thumbnail. Used by the developer reset. */
export function clearMealThumbnails() {
  if (!canStoreThumbnails()) return;
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing stored yet, or already removed.
  }
}
