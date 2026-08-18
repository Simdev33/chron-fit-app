export type FloraChatRole = 'user' | 'assistant';

export type FloraChatMessage = {
  id: string;
  role: FloraChatRole;
  text: string;
};

export type FloraChatRequest = {
  messages: Array<Pick<FloraChatMessage, 'role' | 'text'>>;
};

export type FloraChatResponse =
  | { reply: string }
  | { error: string };
