import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Creates the public 'problem-images' storage bucket if it doesn't exist yet. */
export const ensureProblemBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.getBucket("problem-images");
    if (!data) {
      const { error } = await supabaseAdmin.storage.createBucket("problem-images", { public: true, fileSizeLimit: 50 * 1024 * 1024 });
      if (error && !/exists/i.test(error.message)) throw new Error(error.message);
    }
    return { ok: true };
  });
