
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [{ title: "Verify Email — Inkwell" }],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();

  const [status, setStatus] = useState<
    "loading" | "success" | "error"
  >("loading");

  const [message, setMessage] = useState("");
  const requestStarted = useRef(false);

  useEffect(() => {
    if (requestStarted.current) return;
    requestStarted.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.post("/auth/verify-email", {
          token,
        });

        setStatus("success");
        setMessage(
          response.data.message ||
            "Your email has been verified successfully."
        );

        toast.success("Email verified successfully!");
      } catch (error: any) {
        setStatus("error");
        setMessage(
          error.response?.data?.error ||
            "Unable to verify your email. The link may have expired."
        );
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elevated">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <h1 className="text-xl font-semibold">
              Verifying your email...
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-2xl text-green-600">
              ✓
            </div>
            <h1 className="text-xl font-semibold">
              Email verified!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message}
            </p>

            <Link
              to="/login"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continue to login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-2xl text-destructive">
              !
            </div>
            <h1 className="text-xl font-semibold">
              Verification failed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message}
            </p>

            <Link
              to="/login"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-muted"
            >
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
