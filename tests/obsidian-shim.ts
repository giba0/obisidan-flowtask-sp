export async function requestUrl(): Promise<never> {
  throw new Error("requestUrl must be injected by the test");
}

export type RequestUrlParam = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type RequestUrlResponse = {
  status: number;
  headers: Record<string, string>;
  json: unknown;
  text: string;
};
