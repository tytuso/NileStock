const twoDigits = (value: number) => String(value).padStart(2, "0");

export function createReceiptNumber(
  createdAt: string | number | Date,
  existingReceiptNumbers: readonly string[] = [],
) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid receipt date");

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  const timeParts = [String(hour)];

  if (minutes || seconds) timeParts.push(twoDigits(minutes));
  if (seconds) timeParts.push(twoDigits(seconds));

  const base = [
    "NS",
    date.getFullYear(),
    `${twoDigits(date.getDate())}${twoDigits(date.getMonth() + 1)}`,
    `${timeParts.join("-")}${period}`,
  ].join("-");
  const used = new Set(existingReceiptNumbers);
  if (!used.has(base)) return base;

  let copy = 2;
  while (used.has(`${base}-${copy}`)) copy += 1;
  return `${base}-${copy}`;
}
