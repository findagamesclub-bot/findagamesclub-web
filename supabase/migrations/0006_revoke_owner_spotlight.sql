-- 0006 · spotlight is admin-only
--
-- 0005 originally granted owners update on spotlight. A club that can feature
-- itself makes the featured flag worthless. 0005 has since been corrected, so
-- on a fresh build this is a harmless no-op.

revoke update (spotlight) on public.clubs from authenticated;
