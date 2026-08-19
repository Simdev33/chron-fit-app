import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Large enough that small print stays readable after compression. */
const MAX_EDGE_PX = 1_600;
const JPEG_QUALITY = 0.75;

export type PickedMedicalFile = {
  base64: string;
  mimeType: 'image/jpeg' | 'application/pdf';
  source: 'photo' | 'pdf';
  /** Only set for photos, so a review screen can show a thumbnail. */
  previewUri?: string;
};

/**
 * The web picker reads files with readAsDataURL, so what comes back is a
 * "data:application/pdf;base64,..." URL rather than the bare payload. Sending
 * it whole makes the model reject the file.
 */
function stripDataUrlPrefix(value: string) {
  if (!value.startsWith('data:')) return value;
  const comma = value.indexOf(',');
  return comma === -1 ? value : value.slice(comma + 1);
}

/** Returns null when the user backs out or denies permission. */
export async function pickMedicalPhoto(
  source: 'camera' | 'library',
): Promise<PickedMedicalFile | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  const longestEdge = Math.max(asset.width || 0, asset.height || 0);
  if (longestEdge > MAX_EDGE_PX) {
    const portrait = (asset.height || 0) >= (asset.width || 0);
    context.resize(portrait ? { height: MAX_EDGE_PX } : { width: MAX_EDGE_PX });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });

  if (!saved.base64) return null;
  return {
    base64: stripDataUrlPrefix(saved.base64),
    mimeType: 'image/jpeg',
    source: 'photo',
    previewUri: saved.uri,
  };
}

export async function pickMedicalPdf(): Promise<PickedMedicalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    // Defaults to false on web despite what the docs say, and without it the
    // asset only carries a blob: URI that expo-file-system cannot read there.
    base64: true,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;

  // Web hands back base64 directly; native needs the file read from disk.
  const raw = asset.base64 ?? (await new File(asset.uri).base64());
  if (!raw) return null;

  return {
    base64: stripDataUrlPrefix(raw),
    mimeType: 'application/pdf',
    source: 'pdf',
  };
}
