# Auditoría de código — OídoChef

Fecha: 2026-10-06
Alcance: `src/` (frontend) y `supabase/migrations/` + `supabase/functions/` (esquema SQL y Edge Functions). Modo solo lectura — no se modificó ningún archivo del proyecto durante esta auditoría. Sin acceso a la base de datos en vivo en la pasada de datos/seguridad (se auditó a partir del código y las migraciones).

## Resumen ejecutivo

El código está ordenado en general, sin agujeros de seguridad activos ni fugas de información entre negocios — el aislamiento multi-negocio (RLS) y las funciones del servidor se revisaron a fondo y están bien resueltas. El hallazgo más importante es que **guardar los alérgenos de un ingrediente puede perder ese dato en silencio** si falla a mitad de camino (es un borrado + alta en dos pasos sin transacción), algo delicado porque es información de seguridad alimentaria. El segundo hallazgo real es un bug de interfaz confirmado: **el logo del negocio en el menú lateral no se actualiza** después de cambiarlo en Configuración hasta recargar la página. El resto son oportunidades de limpieza de bajo riesgo (duplicación de código, algunas funciones sin usar) y puntos a vigilar de cara al futuro si el volumen de negocios/datos crece mucho — nada de eso urge hoy con el tamaño actual (5 negocios reales, el más grande con 62 ingredientes).

## Errores reales confirmados

### 1. Guardar alérgenos de un ingrediente puede perder los datos en silencio — ALTA
**Dónde:** `src/features/ingredients/IngredientFormPage.tsx:97-107` (función `saveAllergens`), llamada desde `handleSubmit` en las líneas 129 y 146.

Al guardar un ingrediente, los alérgenos se reemplazan con un `DELETE` seguido de un `INSERT`, como dos llamadas separadas desde el navegador, **sin transacción y sin revisar si cada una tuvo éxito**.

**Por qué importa:** si el `INSERT` falla después de que el `DELETE` ya tuvo éxito (corte de red, pestaña cerrada a mitad, error de validación), el ingrediente queda sin ningún alérgeno registrado y la pantalla no muestra ningún aviso — parece que se guardó bien. Es justo el tipo de error que no se puede permitir en una app que informa alérgenos a cocina.

**Riesgo de corregir:** bajo. Se resuelve con una única función SQL que haga el reemplazo en una transacción, o revisando el `error` de ambas llamadas y avisando si falla.

### 2. El logo del negocio en el menú lateral queda desactualizado tras cambiarlo en Configuración — MEDIA
**Dónde:** `src/app/AppLayout.tsx:63-106` (el `useEffect` que carga `logoUrl` depende solo de `profile?.business_id`, que nunca cambia en la misma sesión) y `src/features/settings/SettingsPage.tsx:19-28,47` (`loadData` solo actualiza el estado local de esa pantalla, no el de `AppLayout`).

**Por qué importa:** si subes o cambias el logo en Configuración, lo ves bien ahí, pero el menú lateral sigue mostrando el anterior hasta recargar la página (F5) — da la impresión de que no se guardó y es fácil terminar subiéndolo dos veces sin necesidad.

**Riesgo de corregir:** bajo — pasar una función de refresco desde `AppLayout` a `SettingsPage`, o mover los datos del negocio a un contexto compartido.

## Código muerto — seguro de borrar

- **`IconMore`** en `src/components/icons/NavIcons.tsx:89-97` — no se usa en ningún lado del proyecto. Confirmado por búsqueda completa. Es un ícono SVG sin efectos secundarios, borrarlo es sin riesgo.

## Duplicación — para consolidar

Ordenado de mayor a menor valor de limpiar.

1. **El sidebar y la barra móvil están copiados entre `AppLayout.tsx` y `SuperAdminLayout.tsx`**, no compartidos — `src/app/AppLayout.tsx:40-48,145-266` vs `src/features/super-admin/SuperAdminLayout.tsx:23-31,42-138`. La estructura del menú, la barra inferior en móvil y el menú de "Cuenta" son prácticamente idénticos entre los dos archivos. *Por qué importa:* cada vez que cambia el diseño del menú hay que acordarse de tocarlo en dos sitios — si se olvida alguno, el panel de Super Admin y la app de cada negocio empiezan a verse distintos sin que nadie lo haya decidido. *Riesgo de limpiar:* medio (se puede extraer un componente compartido, con cuidado porque uno tiene el banner de prueba/gracia y el otro no).

2. **El aviso de "coste incompleto" está escrito 6 veces, con textos que ya no coinciden** ("Incompleto", "Coste incompleto", "Food cost incompleto") — en `RecipesPage.tsx:13-22`, `EscandalloPage.tsx:148-154`, `RecipeComponentsSection.tsx:165-193`, `BakeryComponentsSection.tsx:177-200`, `RecipeViewPage.tsx:148`, `CostesView.tsx:34-61`. *Por qué importa:* es solo presentación (el cálculo real vive intacto en SQL), pero es la señal clásica de que si cambia la regla de qué cuenta como "incompleto", alguien la actualiza en 2 de los 6 sitios y se olvida los otros 4. *Riesgo:* bajo.

3. **El formato de dinero (`.toFixed(2) €` / `.toFixed(4) €`) está escrito a mano en 15+ lugares** sin una función `formatCurrency()` compartida (`IngredientsPage.tsx`, `PurchaseFormatsSection.tsx`, `RecipeComponentsSection.tsx`, `BakeryComponentsSection.tsx`, `EscandalloPage.tsx`, `RecipesPage.tsx`, `RecipeViewPage.tsx`, `CostesView.tsx`, entre otros). *Por qué importa:* si algún día cambia el formato (moneda, decimales), hay que editar 15+ líneas sueltas en vez de una sola función. *Riesgo:* muy bajo.

4. **"Nombre del ingrediente/receta, o 'eliminado' si ya no existe" está reimplementado 4 veces** — `RecipeComponentsSection.tsx:60-65`, `BakeryComponentsSection.tsx:70-72`, `CocinaView.tsx:4-13`, `ProductionPage.tsx:72`. Misma idea, 4 funciones distintas. *Riesgo:* muy bajo.

5. **`formatYield()` copiado palabra por palabra** en `RecipesPage.tsx:8-10` y `EscandalloPage.tsx:7-9` — código idéntico. El caso más claro de copiar y pegar sin ningún beneficio de tenerlo dos veces. *Riesgo:* nulo.

6. **El manejo del error "ciclo detectado" está duplicado dentro del mismo archivo** — `RecipeComponentsSection.tsx:90-94` y `148-150`, misma lógica a 60 líneas de distancia. *Riesgo:* nulo.

7. **Cargar "el coste de la receta, solo si eres admin" está copiado entre las dos secciones de componentes** — `RecipeComponentsSection.tsx:54-57` y `BakeryComponentsSection.tsx:56-60`. Candidato a un hook compartido `useRecipeCost()`. *Riesgo:* bajo.

8. **La barra de guardado nueva (confirmación visible, mensajes de error claros) solo llegó a Recetas, no a Ingredientes** — `RecipeFormPage.tsx:520-539` ya tiene barra fija, "✓ Cambios guardados" y mensajes claros cuando el código/categoría ya existe; `IngredientFormPage.tsx:341-347` sigue con un botón suelto, sin confirmación visual y con mensajes genéricos. *Por qué importa:* editar un ingrediente se siente menos pulido que editar una receta, cuando en realidad el trabajo de hacerlo bien ya está hecho en un lado — solo falta llevarlo al otro. *Riesgo:* bajo-medio (es agregar algo ya probado, no inventar algo nuevo).

## Rendimiento y arquitectura

1. **Editar una fila de la fórmula panadera la escribe dos veces en la base de datos** — `BakeryComponentsSection.tsx`, función `handleRowChange` (líneas 151-156): primero actualiza esa fila sola, y justo después `recalcAndSave` vuelve a actualizar todas las filas, incluida la misma. *Impacto hoy:* insignificante (fórmulas de pocos ingredientes). *Impacto futuro:* si una fórmula crece a 30-40 ingredientes, cada ajuste fino dispara 30-40 escrituras en paralelo en vez de solo las que cambiaron. *Riesgo de corregir:* medio-bajo.

2. **Dashboard de Super Admin: una consulta por negocio para contar usuarios/ingredientes** — `SuperAdminDashboardPage.tsx:76-86`. Ya está bien paralelizado (sin penalización de latencia hoy) y el propio código ya trae un comentario anotando "si esto crece mucho, se puede sustituir por una vista". *Impacto hoy:* ninguno (2-3 negocios). *Impacto futuro:* si la plataforma llega a decenas de negocios, dispara 2×N peticiones simultáneas — ya está anotado qué hacer (una vista SQL agregada).

3. **Tres pantallas podrían ahorrar una vuelta de red** incluyendo la consulta de coste (solo admin) en el mismo `Promise.all` en vez de esperarlo aparte — `RecipeComponentsSection.tsx:43-58`, `BakeryComponentsSection.tsx:44-67`, `RecipeViewPage.tsx:54-82`. Confirmado que esa consulta no depende de las otras tres. *Impacto:* pequeño (decenas de ms por apertura de receta, solo para admin). *Riesgo de corregir:* muy bajo.

4. **`handlePastonBlur` espera sin necesidad un guardado antes de lanzar el otro** — `BakeryComponentsSection.tsx:89-100`. Guarda el Paston/Cantidad y luego espera a `recalcAndSave`, aunque no depende de ese resultado. *Impacto:* mínimo, cosmético.

5. **Consultas sin límite pensado para cuando crezca el volumen** — `IngredientsPage.tsx:22`, `RecipesPage.tsx:40`, `EscandalloPage.tsx:33-36`, `SuperAdminDashboardPage.tsx:68`. Hoy inofensivo (62 ingredientes como máximo); es la lista de pantallas a paginar primero el día que algún negocio crezca mucho. *Riesgo de corregir:* medio (es UI nueva, no una línea).

6. **Falta un índice en `profiles.business_id`**, a diferencia de `ingredients`/`recipes`/`recipe_components`/`productions` que sí lo tienen — `supabase/migrations/20260817074911_schema_v1.sql:39-47`. Impacto mínimo incluso a futuro (la tabla de usuarios crece poco), pero es barato de agregar y mantiene consistencia con el resto del esquema.

7. **El parseo de PDF al importar ingredientes corre en el hilo principal del navegador** (`src/features/ingredients/import/pdfParser.ts`). Imperceptible con catálogos de decenas de filas; solo se notaría con PDFs muy largos. No priorizarlo salvo que aparezca un caso real así.

## Datos, respaldos y seguridad

- **Límites de filas por consulta (máximo 1000 de Supabase):** ninguna lista del frontend pagina hoy, pero con el volumen actual (≤62 filas) no hay riesgo real. Es el mismo punto que en rendimiento — vigilar si algún negocio crece mucho.
- **Respaldos:** lo que promete la interfaz (`BackupSection.tsx`) coincide exactamente con lo que guarda el backend (`backup.restorable_tables()`) — confirmado tabla por tabla contra las 33 migraciones, sin ninguna tabla de negocio nueva que haya quedado afuera por descuido.
- **Restauración:** validación fuerte antes de tocar nada, copia de seguridad previa automática, todo en una sola transacción con reversión completa si algo falla a mitad de camino — confirmado leyendo `restore_business_backup()` completa, sin cambios desde la última revisión.
- **Control de acceso:** el rol "cocina" no puede leer ni escribir `purchase_formats`/`price_history` (donde viven los precios) por RLS, solo admin puede. Las funciones del servidor (`SECURITY DEFINER`) y las Edge Functions (`invite-user`, `delete-user`, `suggest-ingredient-allergens`) verifican quién llama antes de actuar — confirmado en las tres. La función nueva de sugerencia de alérgenos con IA no mezcla datos entre negocios y la clave de Anthropic solo vive en el servidor.
- **Datos personales** de los 5 negocios reales: aislados correctamente por negocio, sin ningún `console.log` que filtre información sensible en todo `src/`.
- **XSS/inyección:** sin `dangerouslySetInnerHTML` en el proyecto; el SQL dinámico del backend usa identificadores seguros (`%I`) con nombres que vienen de un catálogo fijo, nunca de texto escrito por un usuario.

## Verificado y descartado

Hipótesis revisadas que **no** se confirmaron — se investigaron en vez de asumirse:

- El guard contra ciclos (`p_visited`) de `compute_recipe_cost` y `compute_recipe_allergens` se comparó línea por línea: siguen idénticos, no divergieron.
- Las migraciones temporales (`___tmp_introspect.sql`, `___tmp_simulate_invite.sql`) se eliminan correctamente en migraciones posteriores — no quedan restos activos.
- `GRACE_DAYS = 7` (duplicado a propósito entre el cliente y la función SQL `business_is_operational()`) sigue calculando exactamente lo mismo en ambos lados.
- No hay ningún TODO/FIXME/HACK pendiente en el código del proyecto.
- Los buscadores de ingredientes/recetas no disparan ninguna consulta de red por tecla — filtran en memoria con `useMemo`.
- La importación de ingredientes no hace N consultas individuales: usa un índice en memoria y un alta en lote vía una sola función SQL.
- `recipe_costs`/`ingredient_costs` son vistas que se recalculan solas en cada consulta — nunca quedan desactualizadas.
- Generar una hoja de producción es una sola llamada RPC atómica; no puede quedar a medias.

## Hallazgos menores

- `RecipeComponentsSection.tsx` no valida en el formulario de alta que la cantidad sea un número válido ≥ 0 (solo confía en los atributos HTML), mientras que el de edición sí lo valida explícitamente — una pequeña grieta, no un error activo hoy.
- `yieldMismatch(...)` en `RecipeFormPage.tsx:225` se recalcula en cada tecla del formulario completo, no solo cuando cambian los componentes o el rendimiento — imperceptible con recetas chicas, un `useMemo` lo evitaría gratis.
- Algunas pantallas piden `ingredients.select('*')` cuando solo usan el nombre — el tipo `Ingredient` es chico (7 campos), así que el sobre-fetch es insignificante en bytes reales.
