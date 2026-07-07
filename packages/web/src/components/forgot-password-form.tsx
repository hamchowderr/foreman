"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-7 text-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Check Your Email</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">Password reset instructions sent</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you registered using your email and password, you will receive a password reset email.
        </p>
        <Link
          href="/auth/login"
          className="inline-block text-sm text-foreground font-medium underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleForgotPassword} className="space-y-5">
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
          {isLoading ? "Sending..." : "Send reset email"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
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
