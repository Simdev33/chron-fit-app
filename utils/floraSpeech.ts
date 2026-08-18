import { DeviceEventEmitter } from 'react-native';

export const FLORA_SPEECH_EVENT = 'floraSpeech';

type SpeechHandler = (message: string) => void;

const listeners = new Set<SpeechHandler>();

/**
 * Show a short insight in Flóra's floating speech bubble.
 * Safe to call from any screen, sheet, or context.
 */
export function triggerFloraSpeech(message: string) {
  const text = message.trim();
  if (!text) return;
  listeners.forEach((fn) => fn(text));
  DeviceEventEmitter.emit(FLORA_SPEECH_EVENT, text);
}

export function subscribeFloraSpeech(handler: SpeechHandler) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}
