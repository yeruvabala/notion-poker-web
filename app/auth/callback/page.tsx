"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const [message, setMessage] = useState("Processing...");
  const [newPassword, setNewPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    const code = params.get("code");
    const type = params.get("type"); // e.g., "recovery" for password reset

    if (!code) {
      setMessage("Missing code in URL.");
      return;
    }

    (async () => {
      // Exchange code for a session (writes auth cookies via @supabase/ssr)
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage(`Auth error: ${error.message}`);
        return;
      }

      if (type === "recovery") {
        // User just clicked a "reset password" email link
        setNeedsPassword(true);
        setMessage("Enter a new password to finish resetting.");
      } else {
        // Email confirmed or sign-in via link → go home
        router.replace("/");
      }
    })();
  }, [params, router, supabase]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(`Update error: ${error.message}`);
      return;
    }
    setMessage("Password updated. Redirecting…");
    router.replace("/");
  }

  if (needsPassword) {
    return (
      <div className="p-6 max-w-sm mx-auto space-y-4">
        <p>{message}</p>
        <form onSubmit={handleSetPassword} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <button className="border rounded px-3 py-2" type="submit">
            Set new password
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6">
      <p>{message}</p>
    </div>
  );
}
