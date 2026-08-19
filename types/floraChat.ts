export type FloraChatRole = 'user' | 'assistant';

export type FloraChatMessage = {
  id: string;
  role: FloraChatRole;
  text: string;
};

export type FloraChatRequest = {
  /**
   * Rövid összefoglaló a felhasználóról a saját profiljából. A teljes
   * dokumentum sosem hagyja el a készüléket, csak ez a néhány mondat.
   */
  userContext?: string;
  messages: Array<Pick<FloraChatMessage, 'role' | 'text'>>;
};

export type FloraChatResponse =
  | { reply: string }
  | { error: string };
