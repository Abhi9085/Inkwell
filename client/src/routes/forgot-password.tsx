
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";
import { MinimalHeader } from "@/components/navbar";
import { Logo } from "@/components/logo";
import api from "../lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot password — Inkwell" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      setSubmitted(true);
      toast.success(response.data.message);
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Unable to process your request. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MinimalHeader />

      <main className="relative grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-16">
        <div className="absolute inset-0 -z-10 bg-hero-gradient" />

        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="flex justify-center">
              <Logo />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
              Forgot your password?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-elevated">
            {submitted ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Mail className="h-5 w-5" />
                </div>
                <h2 className="font-semibold">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  If an account exists for that email, a reset link will be
                  sent. Check your inbox and spam folder.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Try another email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-5 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            )}

            <Link
              to="/login"
              className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
