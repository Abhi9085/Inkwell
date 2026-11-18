import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Mail, User as UserIcon } from "lucide-react";
import { MinimalHeader } from "@/components/navbar";
import { Logo } from "@/components/logo";
import { Field, GoogleIcon } from "./login";
import { useState } from "react";
import api from "../lib/api";

import {
  GoogleOAuthProvider,
  GoogleLogin,
  type CredentialResponse,
} from "@react-oauth/google";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Inkwell" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password.length < 12 || formData.password.length > 72 ||
        !/[a-z]/.test(formData.password) || !/[A-Z]/.test(formData.password) ||
        !/[0-9]/.test(formData.password) || !/[^A-Za-z0-9]/.test(formData.password)) {
      toast.error("Use 12–72 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Auto-generate a handle for the database since the UI doesn't ask for one
      const handleBase = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 26) || 'writer';
      const generatedHandle = handleBase + Math.floor(Math.random() * 1000);
      
      await api.post('/auth/register', {
        name: formData.name,
        handle: generatedHandle,
        email: formData.email,
        password: formData.password
      });

      toast.success("Welcome to Inkwell!", { description: "Your account is ready." });
      navigate({ to: '/login' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    if (!credentialResponse.credential) {
      toast.error("Google did not return a credential.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      toast.success("Welcome to Inkwell!");

      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Google sign-up failed."
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
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Free forever. Publish your first post in minutes.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-elevated"
          >
            <div className="flex justify-center">
              <GoogleOAuthProvider
                clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
              >
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error("Google sign-up failed.")}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="rectangular"
                  width="320"
                />
              </GoogleOAuthProvider>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or with email
              <div className="h-px flex-1 bg-border" />
            </div>

            <Field label="Full name" icon={<UserIcon className="h-4 w-4" />}>
              <input 
                required 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Amelia Chen"
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/15" 
              />
            </Field>
            
            <Field label="Email" icon={<Mail className="h-4 w-4" />} className="mt-4">
              <input 
                required 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@company.com"
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/15" 
              />
            </Field>
            
            <Field label="Password" icon={<Lock className="h-4 w-4" />} className="mt-4">
              <input 
                required 
                type="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/15" 
              />
            </Field>
            
            <Field label="Confirm password" icon={<Lock className="h-4 w-4" />} className="mt-4">
              <input 
                required 
                type="password" 
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/15" 
              />
            </Field>

            <p className="mt-4 text-xs text-muted-foreground">
              By creating an account, you agree to our{" "}
              <Link to="/" className="text-accent hover:underline">Terms</Link> and{" "}
              <Link to="/" className="text-accent hover:underline">Privacy Policy</Link>.
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-soft transition-all hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}