import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

async function getAuthSettings(apiKey: string) {
  return fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

describe("Supabase connection credentials", () => {
  it("connects to the configured Supabase project with publishable and server keys", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(publishableKey).toBeTruthy();
    expect(secretKey).toBeTruthy();

    const [publishableResponse, secretResponse] = await Promise.all([
      getAuthSettings(publishableKey!),
      getAuthSettings(secretKey!),
    ]);

    expect(publishableResponse.ok).toBe(true);
    expect(secretResponse.ok).toBe(true);
  });
});
