import { MailCheck } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function Page() {
  return (
    <AuthShell>
      <div className="space-y-7">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff4a00]/10 border border-[#ff4a00]/20">
            <MailCheck className="h-7 w-7 text-[#ff4a00]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Check your inbox</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              We sent a confirmation link to your email. Click it to activate your account and get
              started.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Didn&apos;t get an email? Check your spam folder, or{" "}
          <Link
            href="/auth/sign-up"
            className="text-foreground font-medium underline underline-offset-4"
          >
            try again
          </Link>
          .
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already confirmed?{" "}
          <Link
            href="/auth/login"
            className="text-foreground font-medium underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
