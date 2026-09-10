import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import AccountSearch from "@/components/admin/AccountSearch";
import AccountRow from "@/components/admin/AccountRow";
import { listAccounts, toStatus } from "@/services/adminAccounts.service";

export const metadata = { title: "Accounts" };

/**
 * Every account on the site, searched and paged on the server.
 *
 * Server-paged from the first version rather than "when it gets big". The
 * whole point of an accounts screen is that it still works at a hundred
 * thousand people, and a list that loads everything to filter it in the
 * browser cannot be retrofitted into one that does not.
 */
export default async function AdminAccountsPage({
  searchParams,
}: PageProps<"/admin/accounts">) {
  const { q, status: rawStatus, page: rawPage } = await searchParams;

  const query = typeof q === "string" ? q : "";
  const status = toStatus(typeof rawStatus === "string" ? rawStatus : undefined);
  const page = Math.max(1, Number(rawPage) || 1);

  const { accounts, total, perPage } = await listAccounts(query, status, page);

  return (
    <>
      <PageHead
        title="Accounts"
        lede="Find somebody, see what they are attached to, and suspend or restore them."
      />

      <AccountSearch query={query} status={status}>
        {accounts.length ? (
          <Stack spacing={1.5}>
            <Stack spacing={1}>
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </Stack>
            <Pager page={page} total={total} size={perPage} noun="accounts"
              href={{ path: "/admin/accounts", params: { q: query, status } }} />
          </Stack>
        ) : (
          <EmptyState
            title={query ? "Nobody matches that" : "No accounts yet"}
            description={query
              ? "Try part of a name, or the email address they signed up with."
              : "Accounts appear here as people sign up."}
          />
        )}
      </AccountSearch>
    </>
  );
}
