"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/client";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Create an account</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">Get started with Foreman for free</p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-5">
        <Field>
          <FieldLabel htmlFor="email" className="text-sm font-medium">
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-md"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className="text-sm font-medium">
            Password
          </FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-md"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="repeat-password" className="text-sm font-medium">
            Confirm password
          </FieldLabel>
          <Input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            className="h-10 rounded-md"
          />
        </Field>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full h-10 bg-[#ff4a00] hover:bg-[#e64400] text-white rounded-md font-medium"
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
