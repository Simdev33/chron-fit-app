import { Alert, Platform } from 'react-native';

/**
 * react-native-web only stubs Alert, so a multi-button confirm silently does
 * nothing there — the dialog never appears and the action never runs. This
 * routes web to the browser's own confirm instead.
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel = 'Törlés',
  cancelLabel = 'Mégse',
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
