-- VULNERABILIDAD SISTÉMICA (encontrada en Fase 9, ataque adversarial):
-- las políticas RLS de INSERT de recipe_components, purchase_formats,
-- ingredient_equivalences y productions solo comprueban que
-- business_id = get_my_business_id() en la FILA que se inserta — nunca
-- comprobaban que las claves foráneas referenciadas (recipe_id,
-- ingredient_id, component_recipe_id) pertenecieran a ESE MISMO
-- negocio. Verificado en vivo: un admin de Business A podía insertar
-- un recipe_components con business_id=A pero ingredient_id o
-- recipe_id de Business B (incluso "anexar" un componente a la receta
-- de otro negocio), un purchase_format o ingredient_equivalences para
-- un ingrediente ajeno, y una production directamente (bypaseando la
-- función generate_production) para una receta ajena.
--
-- Alcance real: no se demostró fuga de datos económicos (todas las
-- lecturas posteriores -- coste, nombres -- siguen filtradas por RLS
-- de forma independiente y no encuentran esas filas cruzadas), pero es
-- una violación real de integridad multi-negocio: permite escribir
-- referencias cruzadas sin sentido en las tablas de otro negocio.
--
-- FIX: un trigger por tabla verifica que cada FK referenciada
-- pertenezca al mismo business_id de la fila. SECURITY DEFINER para
-- comprobar el business_id real de la fila referenciada
-- independientemente de si la RLS del que llama se lo dejaría ver.

create or replace function public.check_recipe_components_same_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_business uuid;
  v_ingredient_business uuid;
  v_component_recipe_business uuid;
begin
  select business_id into v_recipe_business from public.recipes where id = new.recipe_id;
  if v_recipe_business is distinct from new.business_id then
    raise exception 'La receta del componente no pertenece a este negocio.';
  end if;

  if new.component_type = 'ingredient' then
    select business_id into v_ingredient_business from public.ingredients where id = new.ingredient_id;
    if v_ingredient_business is distinct from new.business_id then
      raise exception 'El ingrediente del componente no pertenece a este negocio.';
    end if;
  else
    select business_id into v_component_recipe_business from public.recipes where id = new.component_recipe_id;
    if v_component_recipe_business is distinct from new.business_id then
      raise exception 'La subreceta del componente no pertenece a este negocio.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_recipe_components_same_business
  before insert or update on public.recipe_components
  for each row
  execute function public.check_recipe_components_same_business();

create or replace function public.check_purchase_formats_same_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingredient_business uuid;
begin
  select business_id into v_ingredient_business from public.ingredients where id = new.ingredient_id;
  if v_ingredient_business is distinct from new.business_id then
    raise exception 'El ingrediente del formato de compra no pertenece a este negocio.';
  end if;
  return new;
end;
$$;

create trigger trg_purchase_formats_same_business
  before insert or update on public.purchase_formats
  for each row
  execute function public.check_purchase_formats_same_business();

create or replace function public.check_ingredient_equivalences_same_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingredient_business uuid;
begin
  select business_id into v_ingredient_business from public.ingredients where id = new.ingredient_id;
  if v_ingredient_business is distinct from new.business_id then
    raise exception 'El ingrediente de la equivalencia no pertenece a este negocio.';
  end if;
  return new;
end;
$$;

create trigger trg_ingredient_equivalences_same_business
  before insert or update on public.ingredient_equivalences
  for each row
  execute function public.check_ingredient_equivalences_same_business();

create or replace function public.check_productions_same_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_business uuid;
begin
  select business_id into v_recipe_business from public.recipes where id = new.recipe_id;
  if v_recipe_business is distinct from new.business_id then
    raise exception 'La receta de la producción no pertenece a este negocio.';
  end if;
  return new;
end;
$$;

create trigger trg_productions_same_business
  before insert or update on public.productions
  for each row
  execute function public.check_productions_same_business();
