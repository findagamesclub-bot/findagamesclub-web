import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MailIcon from "@mui/icons-material/AlternateEmail";
import GavelIcon from "@mui/icons-material/GavelOutlined";
import ShieldIcon from "@mui/icons-material/PrivacyTipOutlined";
import CookieIcon from "@mui/icons-material/CookieOutlined";
import PageHead from "@/components/ui/PageHead";
import SettingField from "@/components/admin/SettingField";
import { getSiteSettings } from "@/services/siteSettings.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Site settings" };

/**
 * The three things legacy keeps in `app-settings.json`, plus the cookie text.
 *
 * Every one of these is on a page a visitor can open, so the lede says so: an
 * admin typing into a box needs to know it publishes, not that it is stored.
 */
export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <PageHead
        title="Site settings"
        lede="The contact address and the legal pages. Everything here is public the moment you save it."
      />

      <Stack spacing={2.5} sx={{ maxWidth: 840 }}>
        <SettingField
          field="contact"
          title="Contact"
          icon={MailIcon}
          label="Contact email"
          help="Shown on the contact page, and where a notice goes when somebody submits a listing."
          value={settings.contactEmail}
        />

        <SettingField
          field="terms"
          title="Terms of use"
          icon={GavelIcon}
          label="Terms of use"
          help="Markdown. Headings with #, lists with -, bold with **, links with [text](url). Empty leaves the placeholder page up."
          value={settings.termsMd}
          multiline
        />

        <SettingField
          field="privacy"
          title="Privacy policy"
          icon={ShieldIcon}
          label="Privacy policy"
          help="Markdown, the same as the terms. Empty leaves the placeholder page up."
          value={settings.privacyMd}
          multiline
        />

        <SettingField
          field="cookies"
          title="Cookie notice"
          icon={CookieIcon}
          label="Cookie notice"
          help="Written now, shown when the cookie banner is built. Nothing renders this yet."
          value={settings.cookiesMd}
          multiline
        />

        <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
          {settings.updatedAt
            ? `Last changed ${new Date(settings.updatedAt).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              })}.`
            : "Nothing has been changed yet."}
        </Typography>
      </Stack>
    </>
  );
}
