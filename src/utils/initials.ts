/** "Gulnabi Afridi" -> "GA". Two letters, because an avatar is 34px wide. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
