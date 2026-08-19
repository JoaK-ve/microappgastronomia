-- IMPORT-ING-1 — importador de ingredientes.
--
-- Una única función transaccional que recibe las filas YA aprobadas por el
-- usuario en el frontend (tras análisis/mapeo/previsualización/validación/
-- revisión) y las escribe usando exactamente el mismo mecanismo que ya usa
-- el alta manual: insert en ingredients, insert en purchase_formats para el
-- precio (nunca se sobrescribe un precio existente — un precio nuevo es
-- siempre una fila nueva, igual que el botón "Añadir" de Formatos de
-- compra). No se crea ninguna tabla ni motor de coste nuevo.
--
-- security invoker (el default): las sentencias internas de esta función
-- quedan sujetas a la RLS real del usuario que llama, así que aunque el
-- chequeo explícito de admin/negocio-operativo de aquí abajo tuviera un
-- fallo, la propia RLS de ingredients/purchase_formats (ya reforzada en
-- SA-3 con business_is_operational) sigue siendo la barrera real.
--
-- business_id se determina SIEMPRE con get_my_business_id() (vía sesión),
-- nunca se lee de las filas — cualquier business_id o ingredient_id que
-- venga en el JSON de otro negocio no tiene ningún efecto: el select de
-- comprobación de propiedad y el insert/update están ambos scoped por RLS
-- al negocio del que llama.
create or replace function public.import_ingredients(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid := public.get_my_business_id();
  v_role public.user_role := public.get_my_role();
  v_row jsonb;
  v_purchase jsonb;
  v_action text;
  v_name text;
  v_category text;
  v_usage_unit public.unit;
  v_ingredient_id uuid;
  v_existing_id uuid;
  v_client_id text;
  v_status text;
  v_results jsonb := '[]'::jsonb;
begin
  if v_business_id is null then
    raise exception 'Sin negocio asociado a la sesión actual.';
  end if;

  if v_role <> 'admin' then
    raise exception 'Solo un administrador puede importar ingredientes.';
  end if;

  if not public.business_is_operational(v_business_id) then
    raise exception 'El negocio no está operativo (trial/gracia vencidos o suspendido).';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_client_id := v_row->>'client_id';
    v_action := v_row->>'action';
    v_ingredient_id := null;
    v_status := 'error';

    begin
      if v_action = 'create' then
        v_name := trim(v_row->>'name');
        v_category := nullif(trim(coalesce(v_row->>'category', '')), '');

        if v_name = '' or v_name is null then
          raise exception 'Nombre vacío.';
        end if;

        v_usage_unit := (v_row->>'usage_unit')::public.unit;

        insert into public.ingredients (business_id, name, category, usage_unit)
        values (v_business_id, v_name, v_category, v_usage_unit)
        returning id into v_ingredient_id;

        v_status := 'created';

      elsif v_action = 'update_price' then
        v_existing_id := nullif(v_row->>'existing_ingredient_id', '')::uuid;

        select id into v_ingredient_id
        from public.ingredients
        where id = v_existing_id and business_id = v_business_id;

        if v_ingredient_id is null then
          raise exception 'El ingrediente no existe o no pertenece a este negocio.';
        end if;

        v_status := 'updated';
      else
        raise exception 'Acción desconocida: %', coalesce(v_action, '(vacía)');
      end if;

      v_purchase := v_row->'purchase';
      if v_purchase is not null and v_purchase <> 'null'::jsonb then
        insert into public.purchase_formats (
          business_id, ingredient_id, description, quantity, unit, price, price_date
        )
        values (
          v_business_id,
          v_ingredient_id,
          coalesce(nullif(trim(v_purchase->>'description'), ''), 'Importado'),
          (v_purchase->>'quantity')::numeric,
          (v_purchase->>'unit')::public.unit,
          (v_purchase->>'price')::numeric,
          coalesce(nullif(v_purchase->>'price_date', '')::date, current_date)
        );
      end if;

      v_results := v_results || jsonb_build_object(
        'client_id', v_client_id,
        'status', v_status,
        'ingredient_id', v_ingredient_id,
        'message', null
      );
    exception when others then
      v_results := v_results || jsonb_build_object(
        'client_id', v_client_id,
        'status', 'error',
        'ingredient_id', null,
        'message', sqlerrm
      );
    end;
  end loop;

  return v_results;
end;
$$;

comment on function public.import_ingredients(jsonb) is 'IMPORT-ING-1: escribe en una sola transacción las filas de importación de ingredientes ya aprobadas por el usuario. business_id siempre viene de la sesión (get_my_business_id), nunca del JSON. Reutiliza los mismos inserts que el alta manual — ningún motor ni tabla nuevos.';
