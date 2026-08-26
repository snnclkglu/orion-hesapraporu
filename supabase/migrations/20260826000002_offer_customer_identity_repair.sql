-- Teklif üzerindeki müşteri adı snapshot'tır; logo için kullanılan kimlik ise
-- aynı resmî unvanlı müşteri satırına bağlı olmalıdır. Benzer ad eşleştirmesi
-- yapılmaz: KARDEMİR A.Ş. ile KARDEMİR ÇH ayrı firmalardır.
update public.offers as offer
set customer_id = customer.id
from public.customers as customer
where lower(btrim(customer.name)) = lower(btrim(offer.customer_name))
  and offer.customer_id is distinct from customer.id;
