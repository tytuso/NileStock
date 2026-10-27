export const ADVISER_HISTORY_MESSAGES = 20;
export const ADVISER_MESSAGE_LENGTH = 6000;
export const ADVISER_INPUT_LENGTH = 2400;

/** Keep useful follow-up context while bounding the input sent on each turn. */
export function adviserMessages(messages: { role: "user" | "assistant"; content: string }[]) {
  const recent = messages.map((m) => ({ role: m.role, content: m.content.trim().slice(0, ADVISER_MESSAGE_LENGTH) }))
    .filter((m) => m.content).slice(-ADVISER_HISTORY_MESSAGES);
  let characters = recent.reduce((total, m) => total + m.content.length, 0);
  while (characters > 20_000 && recent.length > 1) characters -= recent.shift()!.content.length;
  return recent;
}
