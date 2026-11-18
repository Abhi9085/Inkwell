
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock } from "lucide-react";
import { MinimalHeader } from "@/components/navbar";
import { Logo } from "@/components/logo";
import api from "../lib/api";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password — Inkwell" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setToken(
      new URLSearchParams(window.location.search).get("token") || ""
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("This reset link is missing its token.");
      return;
    }

    if (password.length < 12 || password.length > 72 ||
        !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      toast.error("Use 12–72 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/auth/reset-password", {
        token,
        password,
      });

      toast.success(response.data.message);
      navigate({ to: "/login" });
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Unable to reset your password. Request a new link and try again."
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
              Create a new password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a strong password for your Inkwell account.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-elevated"
          >
            {!token ? (
              <p className="text-sm text-muted-foreground">
                Checking your reset link. If it is missing or invalid, request
                a new link from the Forgot Password page.
              </p>
            ) : (
              <>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
                  />
                </div>

                <label
                  htmlFor="confirmPassword"
                  className="mb-2 mt-4 block text-sm font-medium"
                >
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter your password again"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-6 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? "Resetting..." : "Reset password"}
                </button>
              </>
            )}

            <Link
              to="/forgot-password"
              className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Request another reset link
            </Link>
          </form>
        </div>
      </main>
    </div>
  );
}
