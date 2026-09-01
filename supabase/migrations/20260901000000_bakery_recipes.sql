-- "Panadería" — recetas de panadería expresadas en porcentaje panadero
-- (la harina es la base 100%, el resto de ingredientes son % de esa
-- base). No se crea ningún motor de coste nuevo: el frontend calcula
-- los gramos reales a partir del % + Paston/Cantidad y los escribe en
-- las mismas columnas quantity/unit que ya usa el alta manual — el
-- motor de costes (recipe_costs) sigue leyendo exactamente igual que
-- siempre, sin cambios.
--
-- Columnas todas opcionales/con default: las recetas existentes no se
-- ven afectadas en absoluto.

alter table public.recipes
  add column is_bakery boolean not null default false,
  add column paston_grams numeric check (paston_grams > 0),
  add column paston_quantity integer check (paston_quantity > 0);

comment on column public.recipes.is_bakery is 'true = receta de panadería, se entra en modo porcentaje panadero (ver recipe_components.flour_percent). false = receta normal, sin cambio de comportamiento.';
comment on column public.recipes.paston_grams is 'Peso en gramos de una pieza (solo recetas de panadería). Paston × paston_quantity = peso total de la masa, usado para calcular los gramos reales de cada ingrediente a partir de su %.';
comment on column public.recipes.paston_quantity is 'Número de piezas a producir (solo recetas de panadería).';

alter table public.recipe_components
  add column is_flour_base boolean not null default false,
  add column flour_percent numeric check (flour_percent >= 0);

comment on column public.recipe_components.is_flour_base is 'true = este componente cuenta como parte de la harina base (el 100% de referencia). La suma de % de todas las filas marcadas debe dar 100.';
comment on column public.recipe_components.flour_percent is 'Porcentaje panadero del componente (relativo al peso total de harina, no al total de la masa). Solo se usa en recetas con is_bakery=true; quantity/unit siguen siendo la fuente real que lee el motor de costes.';
