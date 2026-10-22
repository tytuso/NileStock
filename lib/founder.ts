const founderEmails = ["opiotitus333@gmail.com", "opiotituss333@gmail.com", "oyagoisaac7@gmail.com"];

export function isFounderEmail(email?: string | null) {
  if (!email) return false;
  const configured = [process.env.NEXT_PUBLIC_FOUNDER_EMAILS || "", process.env.NEXT_PUBLIC_FOUNDER_EMAIL || ""].join(",");
  const allowed = new Set([...founderEmails, ...configured.split(/[;,\n]/).map(value => value.trim().toLowerCase()).filter(Boolean)]);
  return allowed.has(email.trim().toLowerCase());
}
