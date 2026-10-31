import { useEffect, useRef, useState } from "react";

/**
 * State mirrored into the query string (?lr=0.08&fn=valley) so a video
 * description can link straight to a specific setup. Values equal to the
 * default are left out of the URL. The URL is read after hydration, so the
 * server-rendered HTML always shows the defaults.
 */
type Codec<T> = { parse: (s: string) => T | undefined; format: (v: T) => string };

export function useUrlState<T>(key: string, initial: T, codec: Codec<T>) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    const parsed = raw == null ? undefined : codec.parse(raw);
    if (parsed !== undefined) setValue(parsed);
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const s = codec.format(value);
      if (s === codec.format(initial)) url.searchParams.delete(key);
      else url.searchParams.set(key, s);
      window.history.replaceState(null, "", url);
    }, 200);
    return () => window.clearTimeout(id);
  }, [value]);

  return [value, setValue] as const;
}

export const num = (min: number, max: number): Codec<number> => ({
  parse: (s) => {
    const v = Number(s);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
  },
  format: (v) => String(Number(v.toPrecision(4))),
});

export const oneOf = <T extends string>(options: readonly T[]): Codec<T> => ({
  parse: (s) => (options as readonly string[]).includes(s) ? (s as T) : undefined,
  format: (v) => v,
});

export const bool: Codec<boolean> = {
  parse: (s) => (s === "1" ? true : s === "0" ? false : undefined),
  format: (v) => (v ? "1" : "0"),
};

export function useUrlNumber(key: string, initial: number, min: number, max: number) {
  return useUrlState(key, initial, num(min, max));
}
