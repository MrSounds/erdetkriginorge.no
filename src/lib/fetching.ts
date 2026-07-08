export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 7000;
const USER_AGENT = "norgeikrig.no/0.1 (+https://norgeikrig.no)";

type FetchTextOptions = {
  fetcher?: FetchLike;
  headers?: HeadersInit;
  timeoutMs?: number;
};

export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetcher ?? fetch)(url, {
      headers: {
        "User-Agent": USER_AGENT,
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Kilden svarte med HTTP ${response.status}${
          response.statusText ? ` ${response.statusText}` : ""
        }`,
      );
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "Tidsavbrudd mot kilde" : error.message;
  }

  return "Ukjent feil mot kilde";
}
