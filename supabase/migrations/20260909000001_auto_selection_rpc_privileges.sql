-- Supabase varsayılan yetkileri anon rolüne de doğrudan EXECUTE verebilir.
-- PUBLIC üzerindeki REVOKE bu doğrudan hibeyi kaldırmaz.
revoke all on function public.create_offer_item_calculation(uuid,text,jsonb,jsonb,jsonb,text) from anon;
revoke all on function public.bump_auto_selection_catalog_version() from anon, authenticated;
