/** Mobil gezinmenin saf seçim kuralları; veri ve yetki çağrı yerinden gelir. */
export type NavigationAppearance = "auto" | "bottom" | "desktop";

export function shouldUseBottomLayout(appearance: NavigationAppearance, width: number, coarse: boolean): boolean {
  if (appearance !== "auto") return appearance === "bottom";
  return width < 1024 || (width <= 1366 && coarse);
}

export function routeMatches(href: string, pathname: string, search = "", exact = false): boolean {
  const [path, query] = href.split("?");
  if (exact ? pathname !== path : pathname !== path && !pathname.startsWith(path + "/")) return false;
  const current = new URLSearchParams(search);
  return !query || [...new URLSearchParams(query)].every(([key, value]) => current.get(key) === value);
}

export function activeRoute<T extends { href: string; exact?: boolean }>(options: readonly T[], pathname: string, search = ""): T | undefined {
  return options.filter(item => routeMatches(item.href, pathname, search, item.exact))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function highestPriority<T extends { priority: number; id: string }>(entries: readonly T[]): T | undefined {
  return [...entries].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
}
