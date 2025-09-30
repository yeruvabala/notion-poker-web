"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce home
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) router.replace("/");
    })();
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/"); // success → go to dashboard/home
      } else {
        // Sign up (may require email confirmation depending on your settings)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
        });
        if (error) throw error;
        // If confirm-email is ON, tell the user to check email.
        router.replace("/login?check-email=true");
      }
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    });
    if (error) setErr(error.message);
    else alert("Password reset link sent (if the email exists). Check your inbox.");
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-sm underline"
        >
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded p-2"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <button
          className="w-full rounded p-2 border"
          disabled={loading}
          type="submit"
        >
          {loading ? "Please wait..." :
            mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {mode === "signin" && (
        <button
          className="text-sm underline"
          onClick={handleResetPassword}
          disabled={!email}
          title={!email ? "Enter your email above first" : ""}
        >
          Forgot password?
        </button>
      )}
    </div>
  );
}
