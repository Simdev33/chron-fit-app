import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, Platform } from 'react-native';

import { clearDocuments } from '@/utils/documentStore';

/**
 * Everything the app persists between launches. Listed here rather than
 * cleared wholesale so a reset never touches keys other libraries own.
 */
const PERSISTED_KEYS = [
  'crohnsync-profile-v1',
  'crohnsync-healthlog-v1',
  'crohnsync-theme',
];

/**
 * Wipes the saved state and reloads, so the next render is a genuine first
 * launch. The reload matters: the contexts keep their state in memory and
 * write it back on the next change, which would undo the wipe on its own.
 */
export async function resetApp() {
  await AsyncStorage.multiRemove(PERSISTED_KEYS);
  clearDocuments();

  if (Platform.OS === 'web') {
    window.location.reload();
    return true;
  }

  if (typeof DevSettings?.reload === 'function') {
    DevSettings.reload();
    return true;
  }

  // Release builds have no DevSettings; the wipe stands but the caller has to
  // tell the user to restart by hand.
  return false;
}
