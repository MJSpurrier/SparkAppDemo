import { useState } from "react";

import { InstallChoice } from "@/components/nowmode/InstallChoice";
import { useT } from "@/lib/i18n/context";
import { createDeviceAuth, validateAccount, type AccountFieldErrors, type AuthProvider } from "@/lib/nowmode/auth";
import { hadSavedNowMode, useNowMode } from "@/lib/nowmode/store";

const inputClass =
  "mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium text-foreground focus:border-blue focus:outline-none";

/** First launch only. Existing saves never see this, and the tutorial waits until it finishes. */
export function Onboarding({ auth = createDeviceAuth() }: { auth?: AuthProvider }) {
  const t = useT();
  const { ready, state, setPrefs } = useNowMode();
  const [email, setEmail] = useState("");
  const [realName, setRealName] = useState("");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  if (!ready || hadSavedNowMode() || state.prefs.accountReady) return null;

  const errorText = (field: keyof AccountFieldErrors) => {
    const code = errors[field];
    if (!code) return "";
    if (field === "email" && code === "email") return t("onboard.emailInvalid");
    if (field === "username" && code === "username") return t("onboard.usernameInvalid");
    if (field === "email") return t("onboard.emailRequired");
    if (field === "username") return t("onboard.usernameRequired");
    return t("onboard.nameRequired");
  };

  return (
    <div className="absolute inset-0 z-[60] overflow-y-auto bg-background px-5 py-8 text-foreground">
      <form
        className="mx-auto flex min-h-full max-w-sm flex-col justify-center"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = validateAccount({ email, realName, username });
          if (!parsed.ok) {
            setErrors(parsed.errors);
            setFormError("");
            return;
          }
          setErrors({});
          setPending(true);
          const result = await auth.createAccount(parsed.value);
          setPending(false);
          if (!result.ok) {
            setFormError(result.message || t("onboard.failed"));
            return;
          }
          setPrefs({
            email: result.profile.email,
            realName: result.profile.realName,
            username: result.profile.username,
            greetAs: "realName",
            accountReady: true,
          });
        }}
      >
        <InstallChoice onBrowser={() => document.getElementById("signup-email")?.focus()} />
        <h1 id="signup" className="mt-6 text-[28px] font-bold leading-tight tracking-tight">{t("onboard.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("onboard.lead")}</p>
        <label className="mt-6 block text-xs font-semibold">
          {t("onboard.email")}
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            id="signup-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={inputClass}
            required
          />
        </label>
        {errors.email && <p className="mt-1 text-xs text-coral">{errorText("email")}</p>}
        <label className="mt-4 block text-xs font-semibold">
          {t("onboard.name")}
          <input
            type="text"
            autoComplete="name"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            aria-invalid={!!errors.realName}
            className={inputClass}
            required
          />
        </label>
        {errors.realName && <p className="mt-1 text-xs text-coral">{errorText("realName")}</p>}
        <label className="mt-4 block text-xs font-semibold">
          {t("onboard.username")}
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!errors.username}
            className={inputClass}
            required
          />
        </label>
        {errors.username && <p className="mt-1 text-xs text-coral">{errorText("username")}</p>}
        {formError && <p className="mt-3 text-xs text-coral">{formError}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {t("onboard.submit")}
        </button>
        <p className="mt-4 text-xs leading-relaxed text-dim">{t("onboard.note")}</p>
      </form>
    </div>
  );
}
