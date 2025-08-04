import { serve } from "https://deno.land/x/sift@0.5.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const geminiKey = Deno.env.get("GOOGLE_API_KEY")!;

serve(async (req) => {
  const { memoryId, transcript } = await req.json();

  // 1) call Gemini embedding endpoint
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedText?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    }
  );
  const { embedding } = await resp.json();

  // 2) update Supabase
  const { error } = await supabase
    .from("memories")
    .update({ embedding })
    .eq("id", memoryId);

  return new Response(
    error ? JSON.stringify({ error }) : JSON.stringify({ status: "ok" }),
    { headers: { "Content-Type": "application/json" } }
  );
});
