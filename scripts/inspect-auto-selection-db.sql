select jsonb_build_object(
 'migration', (select count(*)=1 from supabase_migrations.schema_migrations where version='20260908000011'),
 'rls', (select jsonb_object_agg(c.relname,c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('auto_selection_catalog_state','offer_item_calculations')),
 'rpc', (select jsonb_build_object('security_definer',p.prosecdef,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_offer_item_calculation')
) as verification;
