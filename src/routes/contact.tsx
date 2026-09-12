import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PublicLayout, PageIntro } from "@/components/public-layout";
import { publicHead } from "@/lib/lane/public-site";
import { supportAvailable, submitSupport } from "@/lib/lane/server/support-fns";
import { measure } from "@/lib/lane/measurement";
import { Field, Textarea, NativeSelect, Button } from "@/components/ui";
export const Route = createFileRoute("/contact")({
  head: () => publicHead("/contact"),
  component: Contact,
});
function Contact() {
  const { user } = useCurrentUserState();
  const availability = useQuery({
    queryKey: ["support-available"],
    queryFn: () => supportAvailable(),
  });
  const [topic, setTopic] = useState<"account" | "desktop" | "privacy" | "other">("account");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const send = useMutation({
    mutationFn: () => submitSupport({ data: { topic, message, website } }),
    onSuccess: () => {
      setMessage("");
      measure("contact_submitted");
    },
  });
  return (
    <PublicLayout>
      <PageIntro eyebrow="HELP WITH YOUR WORKROOM" title="Let’s find the next step.">
        <p>
          For setup and trial questions, start with the{" "}
          <a href="/help" className="underline">
            help centre
          </a>
          . For a connection problem, note your desktop version, marketplace and the stage that
          failed.
        </p>
      </PageIntro>
      <section className="public-section !pt-0 max-w-3xl">
        <p className="mb-6 text-sm leading-7 text-muted">
          Do not send marketplace passwords, cookies, tokens, payment information or private listing
          data. There is no guaranteed response time during this beta.
        </p>
        {availability.isError ? (
          <p role="alert">Support availability could not be checked. Please reload.</p>
        ) : availability.isPending ? (
          <p role="status">Checking support availability…</p>
        ) : !availability.data.enabled ? (
          <div className="public-card">
            <h2 className="font-serif text-2xl">Public support is being prepared.</h2>
            <p className="mt-4 leading-7 text-muted">
              The operator must confirm a monitored support route before general public launch.
              Existing pilot participants can use their established contact. This page is not
              accepting messages yet.
            </p>
          </div>
        ) : !user ? (
          <a className="public-button" href="/login?returnTo=%2Fcontact">
            Sign in to send a support request
          </a>
        ) : send.isSuccess ? (
          <div className="public-card" role="status">
            <h2 className="font-serif text-2xl">Your request has been saved.</h2>
            <p className="mt-4">
              Reference: <span className="break-all font-mono text-sm">{send.data.id}</span>
            </p>
            <p className="mt-4 leading-7 text-muted">
              Keep this reference. Your message is in Lane’s support queue. This is a saved-request
              confirmation, not an email delivery promise.
            </p>
            <button className="mt-5 underline" onClick={() => send.reset()}>
              Send another request
            </button>
          </div>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
          >
            <Field label="What do you need help with?">
              <NativeSelect
                value={topic}
                onChange={(e) => setTopic(e.target.value as typeof topic)}
              >
                <option value="account">Account & trial</option>
                <option value="desktop">Desktop connection</option>
                <option value="privacy">Privacy or deletion request</option>
                <option value="other">Something else</option>
              </NativeSelect>
            </Field>
            <Field label="Your message">
              <Textarea
                minLength={20}
                maxLength={2000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-describedby="message-limit"
              />
            </Field>
            <p id="message-limit" className="text-xs text-muted">
              20–2,000 characters. Up to three requests per account in 24 hours.
            </p>
            <div hidden aria-hidden="true">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            {send.isError && (
              <p role="alert">
                The request was not saved. Check the message length and daily limit, then try again.
              </p>
            )}
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? "Saving…" : "Send support request"}
            </Button>
          </form>
        )}
        <p className="mt-8 text-sm leading-7 text-muted">
          Read how we handle requests in the{" "}
          <a href="/privacy" className="underline">
            privacy notice
          </a>
          . Account-access problems need the operator’s public contact address; that address is
          still awaiting confirmation.
        </p>
      </section>
    </PublicLayout>
  );
}
