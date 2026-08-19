import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { PickedMedicalFile } from '@/utils/pickMedicalFile';

const FOLDER = 'documents';

/**
 * Imported documents live in the app's document directory — on the device,
 * never uploaded anywhere. Web has no persistent filesystem here, so there the
 * import keeps its extracted summary but not the original file.
 */
function documentsDir() {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

export function canStoreFiles() {
  return Platform.OS !== 'web';
}

export type StoredDocument = { fileUri: string; fileName: string };

export function saveDocument(
  file: PickedMedicalFile,
  label: string,
): StoredDocument | null {
  if (!canStoreFiles()) return null;

  try {
    const extension = file.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const fileName = `${label}.${extension}`;
    const target = new File(documentsDir(), fileName);
    if (target.exists) target.delete();
    target.create();
    target.write(file.base64, { encoding: 'base64' });
    return { fileUri: target.uri, fileName };
  } catch {
    // Losing the original is survivable; the extracted data is the point.
    return null;
  }
}

export function deleteDocument(fileUri?: string) {
  if (!fileUri || !canStoreFiles()) return;
  try {
    const file = new File(fileUri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or never written. Nothing to recover from.
  }
}
