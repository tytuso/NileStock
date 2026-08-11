-- Run after creating a business; replace the UUID below with your business id.
do $$declare b uuid:='00000000-0000-0000-0000-000000000000';begin
insert into public.categories(business_id,name) values(b,'Groceries'),(b,'Drinks'),(b,'Household');
insert into public.products(business_id,name,sku,barcode,qr_value,selling_price,cost_price,stock,reorder_level,unit) values
(b,'Sugar 1kg','NS-0001','240100000001','NS:240100000001',5000,4000,18,6,'piece'),(b,'Bread','NS-0002','240100000002','NS:240100000002',5000,4000,15,5,'piece'),(b,'Milk 500ml','NS-0003','240100000003','NS:240100000003',3000,2300,8,5,'piece'),(b,'Soda 500ml','NS-0004','240100000004','NS:240100000004',2000,1400,32,8,'piece');end$$;
