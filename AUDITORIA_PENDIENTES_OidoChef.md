# Pendientes de la auditoría — OídoChef

Generado: 2026-10-06. Marca `[x]` cuando esté arreglado Y verificado que sigue funcionando
-- no alcanza con haber tocado el código. Vuelve a correr la skill más adelante para
confirmar que el arreglo quedó bien y encontrar lo que haya quedado nuevo.

## 🟠 Errores reales confirmados
- [x] **Alérgenos de un ingrediente pueden perderse en silencio al guardar** — `src/features/ingredients/IngredientFormPage.tsx:97-107` — el reemplazo es un DELETE + INSERT en dos pasos, sin transacción ni revisar errores. *Arreglado en V1.11.2: función `replace_ingredient_allergens()` atómica, verificado en producción.*
- [x] **Logo del sidebar no se actualiza tras cambiarlo en Configuración** — `src/app/AppLayout.tsx:63-106` / `src/features/settings/SettingsPage.tsx:19-28` — hace falta recargar la página para verlo. *Arreglado en V1.11.3: Configuración avisa al sidebar vía Outlet context, verificado en producción (subir y quitar logo, ambos sin recargar).*

## 🟡 Rendimiento y arquitectura
- [x] **Editar una fila de la fórmula panadera la escribe dos veces** — `src/features/recipes/BakeryComponentsSection.tsx:151-156`. *Arreglado en V1.11.4: una sola escritura por fila, verificado en producción (3 llamadas en vez de 4, datos idénticos).*
- [ ] **Dashboard de Super Admin: una consulta por negocio** (ya anotado en el propio código) — `src/features/super-admin/SuperAdminDashboardPage.tsx:76-86`
- [x] **Consulta de coste separada del resto en 3 pantallas** — `RecipeComponentsSection.tsx:43-58`, `BakeryComponentsSection.tsx:44-67`, `RecipeViewPage.tsx:54-82`. *Arreglado en V1.11.5: va en el mismo Promise.all, verificado en producción (admin ve el costo igual en las 3 pantallas, cocina sigue sin verlo, sin errores).*
- [x] **`handlePastonBlur` espera un guardado que no necesita esperar** — `BakeryComponentsSection.tsx:89-100`. *Arreglado en V1.11.6: guardado y recálculo en paralelo, verificado en producción (paston_grams, paston_quantity y gramos recalculados, los tres correctos en la base de datos).*
- [x] **Falta índice en `profiles.business_id`** — `supabase/migrations/20260817074911_schema_v1.sql`. *Arreglado: `profiles_business_id_idx`, verificado que existe en producción. Sin cambios de app, no suma versión.*

## 🔵 Datos, respaldos y seguridad
- [ ] **Sin paginación en listas de ingredientes/recetas/dashboard** (vigilar si algún negocio crece mucho) — `IngredientsPage.tsx:22`, `RecipesPage.tsx:40`, `EscandalloPage.tsx:33-36`, `SuperAdminDashboardPage.tsx:68`

## ⚪ Código muerto y duplicación (bajo riesgo)
- [x] **`IconMore` sin usar** — `src/components/icons/NavIcons.tsx:89-97`. *Eliminado en V1.11.7.*
- [ ] **Sidebar duplicado entre `AppLayout.tsx` y `SuperAdminLayout.tsx`**
- [ ] **Aviso de "coste incompleto" escrito 6 veces con textos distintos**
- [x] **Formato de dinero (`.toFixed(2) €`) repetido en 15+ lugares, sin `formatCurrency()`**. *Arreglado en V1.11.9: una sola función en `src/lib/format.ts`, verificado en producción.*
- [x] **"Ingrediente/receta eliminada" reimplementado 4 veces**. *Arreglado en V1.11.8: dos constantes compartidas en `src/lib/recipeFormatting.ts`, verificado en producción.*
- [x] **`formatYield()` copiado literal en `RecipesPage.tsx` y `EscandalloPage.tsx`**. *Arreglado en V1.11.8: una sola función en `src/lib/recipeFormatting.ts`.*
- [ ] **Manejo del error "ciclo detectado" duplicado dentro de `RecipeComponentsSection.tsx`**
- [ ] **Carga del coste de receta duplicada entre `RecipeComponentsSection.tsx` y `BakeryComponentsSection.tsx`**
- [ ] **Barra de guardado con confirmación visible: falta llevarla de Recetas a Ingredientes** — `IngredientFormPage.tsx:341-347`
