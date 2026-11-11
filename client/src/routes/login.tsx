import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { MinimalHeader } from "@/components/navbar";
import { Logo } from "@/components/logo";
import api from "../lib/api";

import {
  GoogleOAuthProvider,
  GoogleLogin,
  type CredentialResponse,
} from "@react-oauth/google";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Inkwell" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await api.post('/auth/login', formData);
      
      // Store the JWT token for authenticated requests
      localStorage.setItem('token', response.data.token);
      
      // Optionally store user info for display in the UI (navbar, profile, etc.)
      localStorage.setItem('user', JSON.stringify(response.data.user));

      toast.success("Welcome back!", { description: `Signed in as ${formData.email}` });
      
      // Redirect to the home feed or dashboard
      navigate({ to: '/' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    if (!credentialResponse.credential) {
      toast.error("Google sign-in did not return a credential.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      toast.success("Successfully signed in with Google!");

      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Google sign-in failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MinimalHeader />
      <div className="relative grid min-h-[calc(100vh-4rem)] place-items-center overflow-hidden px-4 py-16">
        <div className="absolute inset-0 -z-10 bg-hero-gradient" />

        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center">
            <div className="mx-auto flex justify-center"><Logo /></div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Log in to keep writing and reading great stories.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-elevated"
          >
            <div className="flex justify-center">
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <GoogleOAuthProvider
                  clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
                >
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error("Google sign-in failed.")}
                    theme="outline"
                    size="large"
                    shape="rectangular"
                    text="continue_with"
                    width="320"
                  />
                </GoogleOAuthProvider>
              ) : (
                <p className="text-sm text-destructive">
                  Google sign-in is not configured.
                </p>
              )}
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or with email
              <div className="h-px flex-1 bg-border" />
            </div>

            <Field label="Email" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@company.com"
                className="peer h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/15"
              />
            </Field>

            <Field label="Password" icon={<Lock className="h-4 w-4" />} className="mt-4">
              <input
                type={show ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="peer h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/15"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <div className="mt-4 flex items-center justify-between text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-[--color-accent]"
                  defaultChecked
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="font-medium text-accent hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-soft transition-all hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Inkwell?{" "}
            <Link to="/signup" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  icon,
  className = "",
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        {children}
      </div>
    </label>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12S6.7 21.7 12 21.7c6.9 0 9.5-4.8 9.5-8.6 0-.6-.1-1-.1-1.5H12z" />
    </svg>
  );
}