export const CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES = [5, 10, 20] as const;
export type ChatAttentionSnoozeOptionMinutes = typeof CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES[number];
export const DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES: ChatAttentionSnoozeOptionMinutes = CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES[0];
