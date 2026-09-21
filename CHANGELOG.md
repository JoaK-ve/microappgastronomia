# Changelog

Versionado de la **aplicación** (`VMAJOR.MINOR.PATCH`) — independiente
de la versión de cada receta (`recipes.version`). MAJOR solo cambia por
decisión explícita; MINOR y PATCH van de 0 a 20 dentro de V1.

## V1.9.1

**Recuperar una restauración equivocada: procedimiento escrito y ensayado** (`docs/RECUPERAR_COPIA_PREVIA.md`, enlazado desde el README).

- V1.9.0 guarda una copia previa antes de cada restauración, pero recuperarla solo era posible "a mano por SQL" y **nunca se había ensayado**. Ahora hay un procedimiento de 3 pasos: listar las copias, recuperar, comprobar.
- La recuperación no duplica lógica: llama a `restore_business_backup` — el mismo código, con las mismas comprobaciones que usa la app — actuando como un admin del negocio solo durante la transacción. Por eso es todo o nada, exige negocio operativo, y **también deja su propia copia previa**: una recuperación equivocada se puede deshacer.
- **Ensayado con datos de prueba en producción (26 comprobaciones)** ejecutando *el texto exacto del documento*, no una versión aparte: el admin restaura el archivo viejo y "pierde" su trabajo; la recuperación lo devuelve idéntico tabla por tabla; una fecha equivocada, un negocio inexistente y un negocio suspendido se rechazan sin cambiar nada; y la propia recuperación se deshace y se rehace. Sin restos de prueba.
- **No cubre** el respaldo diario (`reason = 'daily'`, todos los negocios juntos): usa otro procedimiento que todavía no está ensayado. Tampoco sirve si se pierde el proyecto entero.
- Sin cambios en la app ni en la base de datos.

## V1.9.0

**Respaldo y restauración por negocio** — a petición del usuario ("como hacemos en WheelOS"): cada negocio puede llevarse una copia de SUS datos y volver a cargarla, sin depender de la plataforma. Configuración → "Respaldo" (solo admin).

- **Descargar respaldo**: baja un `.json` con los ingredientes, formatos de compra y precios, equivalencias, historial de precios, alérgenos, categorías, recetas, componentes y producciones del negocio. Nombre `oidochef-respaldo-<negocio>-<fecha>.json`.
- **Restaurar desde un archivo**: valida el archivo, muestra un resumen ("el respaldo trae X… ahora tienes Y…") y exige marcar "Entiendo que esto reemplaza mis datos actuales" antes de tocar nada. **Reemplaza** lo actual por lo del archivo.
- No toca usuarios, contraseñas, plan/prueba del negocio ni el logo. (Un respaldo viejo no puede "devolver" un trial vigente.)
- **Dos funciones nuevas en la base de datos**, `export_business_backup()` y `restore_business_backup(jsonb)`. Son `SECURITY DEFINER` (la RLS no da al admin borrado sobre todas estas tablas) pero todo queda acotado a mano al negocio de quien llama: solo admin; restaurar exige además negocio operativo (SA-3: un negocio suspendido no escribe, aunque sí puede descargar sus datos); `business_id` se fuerza al de la sesión en cada fila, nunca el del archivo; los ids se insertan con `INSERT` plano (jamás upsert), así que un archivo manipulado con ids ajenos choca con la clave primaria en vez de pisar nada; y el archivo solo restaura en el negocio del que salió.
- **Todo o nada**: una sola transacción. Un fallo a mitad de la restauración deja el negocio exactamente como estaba.
- **Red de seguridad**: antes de reemplazar se guarda una copia del estado actual en `backup.snapshots` (`reason = 'pre_restore'`, con quién y cuándo, conservada 90 días). El usuario no puede recuperarla por sí mismo — si restaura el archivo equivocado, la plataforma puede devolverla.
- Genérico a propósito (exporta con `to_jsonb`, restaura las columnas que traiga el archivo y deja el DEFAULT de las que falten): una columna nueva en el futuro no se pierde en silencio, y los archivos viejos siguen restaurando.
- **Probado de verdad contra producción con cuentas y negocios desechables (55 comprobaciones)**: ida y vuelta idéntica tabla por tabla; cocina y anónimos rechazados; archivo de otro negocio rechazado; cabecera falsificada, componentes/historial de precios/alérgenos que apuntan a datos de otro negocio, y 9 tipos de archivo mal formado, todos rechazados sin tocar nada; autor de producción inexistente; archivo anterior a columnas nuevas; fallo tardío con deshacer completo; negocio suspendido. La prueba encontró un bug real antes de salir (la exportación ordenaba por una columna `id` que `ingredient_allergens` no tiene) — corregido en `20260921100100_fix_export_ordering.sql`. Además se probó el flujo completo en pantalla (descargar, borrar datos, restaurar, errores del archivo).
- 14 tests unitarios nuevos para la validación del archivo (`backupFile.test.ts`).
- **Límite**: la copia previa vive en la misma base de datos, igual que el respaldo diario de V1.8.2.

## V1.8.2

**Respaldo diario automático dentro de Supabase** — a petición del usuario, tras un aviso de Supabase sobre suspensión por inactividad de proyectos gratuitos.

- Cron `daily-snapshot` (`pg_cron`, todos los días a las 03:00 UTC): copia **todas las tablas del esquema `public`** (una fila por tabla y día, con sus filas en `jsonb`) a `backup.snapshots` y borra las de más de 30 días. Función `backup.take_snapshot(p_keep_days)`.
- Pensado contra el error humano (borrar o editar algo por accidente), que es el riesgo real del día a día. Cómo restaurar una tabla queda documentado en la propia migración (`jsonb_populate_recordset`).
- **Verificado de verdad, no solo creado**: las 14 tablas de la primera copia coinciden fila por fila con las reales (234 filas en total — se comprobó a propósito porque una copia hecha bajo RLS podría salir vacía sin avisar), y se reconstruyeron los 99 ingredientes desde el JSON para confirmar que se puede restaurar.
- El esquema `backup` no está expuesto por la API (PostgREST responde `406 Invalid schema`) y `anon`/`authenticated` no tienen permisos sobre él.
- **Límites, a propósito**: vive en la misma base de datos, así que **no protege si se pierde el proyecto entero** — no sustituye a un respaldo fuera de Supabase. Tampoco incluye `auth.users` (los accesos) ni los archivos de Storage (logos). El aviso de suspensión por inactividad se previene con uso real del proyecto (o con el plan Pro), no con este respaldo.

## V1.8.1

Botón "✨ Sugerir con IA" en el alta/edición de un ingrediente (V1.8.0) — para cuando quien lo carga no sabe de memoria si contiene algún alérgeno.

- Nueva Edge Function `suggest-ingredient-allergens` (solo admin, mismo patrón de autenticación que `invite-user`): le pasa el nombre y categoría del ingrediente a Claude Haiku, que devuelve los alérgenos que le corresponden con confianza — y, si es un producto comercial donde el alérgeno real depende de la marca (salsas, mejoradores...), **no adivina**: deja una nota explicando qué revisar en la etiqueta real, en vez de marcar algo sin certeza.
- La sugerencia solo pre-marca las casillas — **nunca guarda sola**, sigue haciendo falta pulsar "Guardar" para confirmar. Mismo principio que el importador: la IA propone, la persona decide.
- **Pendiente de un paso manual para quedar activo**: falta cargar el secreto `ANTHROPIC_API_KEY` en el proyecto de Supabase (Project Settings → Edge Functions → Secrets) — sin él, el botón responde con un aviso claro en vez de fallar en silencio.

## V1.8.0

**Alérgenos** — los 14 de declaración obligatoria en la UE (Reglamento 1169/2011), marcados por ingrediente y heredados automáticamente por cada receta.

- Nueva tabla `ingredient_allergens`: en el alta/edición de un ingrediente se marcan los alérgenos que contiene (casillas, mismo criterio de permisos que el resto del ingrediente — todo el negocio ve, solo admin edita).
- Cada receta calcula sus alérgenos solos, sumando los de sus componentes — ingredientes directos y subrecetas, **recursivamente**. Mismo patrón que el motor de costes (`compute_recipe_cost`): una función `compute_recipe_allergens` con la misma protección contra ciclos, expuesta en una vista `recipe_allergens`. Ningún motor nuevo que mantener aparte.
- A diferencia del coste, los alérgenos los ve **cualquier rol** (cocina incluido) — es información de seguridad alimentaria, no financiera.
- Se muestran en la ficha de cocina y en la vista completa de cada receta, como aviso destacado arriba de todo.
- Verificado en producción con cuenta desechable: cadena real de 3 subrecetas anidadas (Nivel 1 → Nivel 2 → Nivel 3) propaga el alérgeno correctamente hasta arriba; rol cocina lo ve, guardado/edición de casillas confirmado contra la base de datos.
- Los ~99 ingredientes reales existentes (Tío Pollo + La Esquina Caliente) todavía no tienen alérgenos marcados — pendiente una clasificación asistida, revisada por el usuario antes de guardar nada (igual que el importador: nada se escribe sin aprobación).

## V1.7.2

**Corrección de un bug real en la fórmula panadera** (V1.7.0), encontrado por el usuario probando la app: "el peso del paston es el total de la sumatoria de los ingredientes, no de la harina, y con una regla de 3 sacas cuánta harina necesitas".

- El cálculo trataba Paston × Cantidad como si fuera el peso de la **harina**, cuando en realidad es el peso **total de la masa** (todos los ingredientes sumados). El peso de la harina se saca por una regla de tres usando la suma de **todos** los % cargados (no solo los marcados "harina base"): `harina = masa total / (suma de todos los % / 100)`.
- Con la fórmula anterior, cualquier receta con más de una fila de harina base daba gramos incorrectos en cuanto se agregaban ingredientes no-harina — el bug pasó una verificación previa por error (comparé mal los números contra la hoja original).
- Fórmula extraída a `src/features/recipes/bakeryFormula.ts`, con 5 tests nuevos (`bakeryFormula.test.ts`) contra los datos reales de "Pan Blanco de Aceitunas" — así no se puede repetir en silencio.
- Re-verificado en producción con cuenta desechable: los 8 ingredientes de la fórmula real dan gramos exactos a la hoja original (541g, 60g, 301g, 12g, 12g, 120g, 90g, 3g).

## V1.7.1

Identidad visual del panel de Super Admin — última pieza pendiente del rediseño terracota/crema (V1.5.1/V1.6.0), aplicada ahora también aquí.

- Sidebar oscura + navegación con iconos, igual patrón que la app principal: lista con iconos en escritorio, barra inferior deslizable con "Cuenta" en móvil/tablet (`useState`/`useEffect` y clases calcadas de `AppLayout.tsx`, cero duplicación de lógica nueva).
- 3 iconos nuevos en `NavIcons.tsx`: `IconBriefcase` (Negocios), `IconClipboard` (Auditoría), `IconShield` (Mi seguridad) — reutiliza `IconHome` y `IconUser` ya existentes para Dashboard/Usuarios.
- Botones primarios y la insignia de estado "Active" (antes `bg-neutral-900`) pasan a `bg-brand-500` terracota, mismo criterio que el resto de la app.
- Verificado con cuenta desechable de Super Admin (creada y eliminada en la misma sesión): escritorio y móvil, navegación activa, panel de "Cuenta", insignias de estado — todo correcto.

## V1.7.0

Nueva sección "Panadería" — recetas de panadería en formato de porcentaje panadero (fórmula profesional real, a partir de una hoja de cálculo del negocio "La Esquina Caliente" con ~40 fórmulas reales de pan/repostería).

- Nuevo ítem de navegación "Panadería", separado de "Recetas" pero reutilizando exactamente el mismo motor de costes y de producción — sin motor nuevo, sin RPC nueva.
- Cada ingrediente de una receta de panadería puede marcarse "harina base" (puede repartirse entre varias filas, ej. dos tipos de harina); la suma de esos % define el 100% de referencia. El resto de ingredientes son % de esa misma base.
- Inputs de **Paston** (peso por pieza, g) y **Cantidad** (piezas a producir) en la propia receta: de ahí se calculan automáticamente los gramos reales de cada ingrediente, que se guardan en las mismas columnas `quantity`/`unit` que usa el alta manual normal.
- Nuevas columnas `recipes.is_bakery`/`paston_grams`/`paston_quantity` y `recipe_components.is_flour_base`/`flour_percent` (todas opcionales — las recetas existentes no se ven afectadas).
- **23 ingredientes de panadería importados** para La Esquina Caliente (Harina Heredia, H. La Estampa, Masa Madre, Levadura fresca/instantánea, etc.), extraídos por estructura de la hoja real del negocio — 6 ya existían y se reutilizaron en vez de duplicarse (Azúcar, Sal, Orégano, Harina de trigo, Leche, Huevo mediano). Precios dejados sin definir a propósito (decisión del usuario) — se cargan desde la app cuando estén disponibles.
- Se agregó la equivalencia gramos↔litros (1000g = 1L) para "Agua (panadería)", necesaria porque el % panadero calcula todo en masa pero esa ingrediente usa unidad de volumen.
- Verificado en producción (cuenta desechable, datos de prueba eliminados al terminar): fórmula real "Pan Blanco de Aceitunas" reproducida exacta (mismos gramos que la hoja original), coste por componente, ficha, producción y aislamiento entre listas "Recetas"/"Panadería" — todo correcto.

## V1.6.4

Mismo tratamiento visual para los otros dos correos de auth reales: confirmación de registro y recuperar contraseña.

- Nuevas plantillas `supabase/templates/confirmation.html` y
  `supabase/templates/recovery.html`, mismo estilo que la de invitación
  (V1.6.3): fondo crema, cabecera terracota oscura, botón de acento,
  texto en español.
- Documentadas en `config.toml` (`[auth.email.template.confirmation]`,
  `[auth.email.template.recovery]`). Misma limitación que la de
  invitación: no se aplican solas a producción, se pegan a mano en el
  Dashboard hasta reconciliar `site_url`.

## V1.6.3

Plantilla propia para el correo de invitación (a petición del usuario, tras ver el correo genérico de Supabase: "es terrible").

- Nueva plantilla `supabase/templates/invite.html`: identidad visual de
  OídoChef (fondo crema, cabecera terracota oscura, botón de acento
  `#c1502b`), texto en español, saludo personalizado con
  `{{ .Data.name }}` cuando está disponible.
- Documentada en `config.toml` (`[auth.email.template.invite]`) para
  `supabase start` en local y para un futuro `supabase config push`.
- **No aplicada aún a producción de forma automática**: `config push`
  subiría todo `config.toml`, incluido `site_url` (que localmente
  apunta a `localhost` y nunca se reconcilió con producción) — hacerlo
  ahora rompería los enlaces de los correos de auth reales. Hasta que
  se resuelva ese valor, la plantilla se pega a mano en el Dashboard
  (Authentication > Email Templates > Invite user).

## V1.6.2

Dashboard de Super Admin interactivo (a petición del usuario: "no hay ningún tipo de interacción con las tarjetas").

- Las tarjetas de conteo ahora son clicables: "Negocios" y "Vencen
  pronto" llevan al listado de negocios, "Usuarios totales" al
  directorio de usuarios.
- Nueva tarjeta "⚠️ Vencen pronto": negocios en trial/gracia con 3 días
  o menos restantes, para poder contactarlos antes de que se suspendan
  solos.
- Nueva sección "Negocios recientes": los 5 negocios más nuevos, con
  usuarios/ingredientes reales y estado, cada fila clicable a su ficha.
- Nueva sección "Actividad reciente": últimas 5 acciones de plataforma
  (auditoría + cambios de ciclo de vida), cada una clicable al negocio
  afectado, con tiempo relativo ("hace 2 h", "ayer").
- **Bug real encontrado y corregido durante la verificación**: el
  conteo de ingredientes por negocio daba 0 para todos, incluidos
  negocios con datos reales — el Super Admin nunca tuvo permiso de
  lectura (RLS) sobre `ingredients`, solo sobre `businesses`/`profiles`.
  Nueva policy aditiva `super admin select all ingredients` (mismo
  patrón que las ya existentes para businesses/profiles, sólo lectura).

## V1.6.1

Ajuste pedido tras V1.6.0: la barra inferior de móvil se desliza en vez de agrupar bajo "Más".

- Los 6 iconos de navegación (Inicio, Ingredientes, Recetas, Escandallo,
  Producción, Configuración) van todos en la misma barra inferior, que
  se desliza horizontalmente cuando no caben — ya no se agrupan dos
  detrás de un botón "Más".
- Se añade un séptimo icono "Cuenta" (siempre visible/alcanzable) que
  abre un panel mínimo con Cambiar contraseña y Cerrar sesión — antes
  vivía mezclado con Escandallo/Configuración dentro de "Más".

## V1.6.0

Navegación con iconos, y barra inferior propia en móvil/tablet.

- Cada sección (Inicio, Ingredientes, Recetas, Escandallo, Producción,
  Configuración) tiene ahora un icono propio (SVG, sin dependencias),
  visible tanto en el sidebar de escritorio como en móvil.
- En escritorio: mismo sidebar de siempre, ahora con icono + etiqueta.
- En móvil/tablet (por debajo de `md`): la navegación ya no vive en una
  fila de píldoras arriba — pasa a una barra fija abajo con Inicio,
  Ingredientes, Recetas y Producción. Escandallo y Configuración (ambas
  solo admin) junto con Cambiar contraseña y Cerrar sesión se agrupan
  bajo un quinto botón "Más", que abre un panel encima de la barra.
- Efecto secundario positivo: al quitar la fila de navegación de arriba,
  la franja superior en móvil baja de 202px a 158px de alto.
- Existen ahora dos `<nav>` en el DOM (uno por tamaño, alternados por
  CSS) — cada uno con su propio `aria-label` ("Navegación principal" /
  "Navegación móvil") para que no se confundan entre sí ni para
  lectores de pantalla ni para tests.

## V1.5.3

Mismo arreglo de móvil que V1.5.2, aplicado al sidebar del Super Admin.

- Medido igual que en la app principal: en 375×812 el sidebar de
  `/super-admin` ocupaba 222px (27% de la pantalla) antes de mostrar
  contenido. El email de la cuenta pasa a ser solo de escritorio
  (`md:block`); "Cambiar contraseña" y "Cerrar sesión" siguen
  alcanzables en ambos tamaños. Baja a 178px (22%).
- El Super Admin sigue sin recibir la paleta cálida (terracota/crema) —
  esto es solo la corrección de móvil, la identidad visual sigue
  pendiente como fase aparte.

## V1.5.2

Corrección de móvil: el sidebar ocupaba más de un tercio de la pantalla.

- En móvil, la barra lateral (ahora oscura desde V1.5.1) mostraba nombre,
  email, versión de la app y todo el resto del contenido antes de llegar
  a la pantalla real — 299px de 812px de alto, solo de "cromo".
- Nombre/email y la línea de versión pasan a ser solo de escritorio
  (`md:block`) — decorativos, no esenciales en el móvil. "Cambiar
  contraseña" y "Cerrar sesión" siguen alcanzables en ambos tamaños.
- Logo/marca con menos padding vertical en móvil.
- Resultado: la barra baja de 299px a 202px de alto en un viewport de
  375×812 — el contenido aparece mucho antes al entrar desde el móvil.

## V1.5.1

Identidad visual "cálida, tipo restaurante" (terracota + crema) en la app principal.

- Nueva paleta de marca: fondo crema, sidebar en marrón oscuro, terracota
  como único color de acento (botones primarios, elemento de navegación
  activo). Definida de forma centralizada en `src/index.css`
  (redefine la escala `neutral` de Tailwind + nueva escala `brand`), no
  archivo por archivo — así toda la app principal (Login, Registro,
  Recuperar contraseña, Inicio, Ingredientes, Recetas, Producción,
  Escandallo, Configuración, importador) queda coherente de una sola vez.
- `ChangePasswordControl` gana una variante `dark` para verse bien tanto
  en el sidebar oscuro de la app principal como en el panel de Super
  Admin (que de momento mantiene su estilo anterior, a propósito).
- El panel de Super Admin **no se tocó en esta pasada** — se acordó
  empezar por la app principal; su turno visual llega después.

## V1.5.0

SA-4: Super Admin completo / administración de plataforma.

- El Super Admin ya no es solo de lectura: desde `/super-admin` puede
  editar los datos de cualquier negocio (nombre/teléfono/email/dirección/
  logo), gestionar sus usuarios (invitar, cambiar rol admin/cocina,
  eliminar, enviar recuperación de acceso) sin entrar como miembro de ese
  negocio. Camino de autorización propio (RPCs nuevas + policies nuevas
  scoped a `is_super_admin()`), no reutiliza las policies de auto-edición
  del admin normal.
- Condición de seguridad exigida explícitamente: **ningún negocio puede
  quedar sin ningún ADMIN**. Degradar al último admin a Cocina o
  eliminarlo queda rechazado por el backend (RPC `super_admin_set_user_role`
  y la Edge Function `delete-user`), no solo por la interfaz.
- Nueva navegación: Dashboard (conteos), Negocios, Usuarios (directorio
  plano de toda la plataforma), Auditoría, Mi seguridad.
- Auditoría de plataforma: tabla nueva `platform_audit_log` (editar
  negocio, invitar, cambiar rol, eliminar, enviar recuperación — solo
  acciones ejecutadas por Super Admin), complementaria a
  `business_lifecycle_events` (SA-3), que sigue intacta.
- Recuperación de acceso: nuevo enlace "¿Olvidaste tu contraseña?" en
  `/login`, disponible para cualquier usuario (incluido el propio Super
  Admin) — antes no existía ningún camino de autorrecuperación desde
  fuera de la app. Usa exclusivamente el mecanismo ya existente de
  Supabase Auth (`resetPasswordForEmail`), sin contraseñas maestras ni
  almacenadas.
- **Bug real encontrado y corregido durante las pruebas** (preexistente,
  no introducido por SA-4): una invitación real por correo creaba un
  negocio nuevo y volvía admin al invitado, en vez de unirlo al negocio y
  rol pedidos — condición de carrera entre el INSERT y el UPDATE que
  GoTrue hace sobre `auth.users` al invitar. Corregido con un trigger de
  saneamiento que no toca la lógica de alta normal (ver CHANGELOG interno
  en la migración `20260819250000`).
- No se implementó impersonation ("entrar como este usuario") — queda
  documentado como posible fase futura, explícitamente fuera de esta
  tarea.

## V1.4.0

IMPORT-ING-1: importador inteligente de ingredientes.

- Nueva pantalla `/ingredientes/importar`, accesible desde "Importar
  ingredientes" junto a "+ Nuevo ingrediente". Flujo obligatorio: fuente
  → análisis → mapeo → previsualización → validación → revisión →
  confirmación → importación → resumen. Nunca se escribe nada en la base
  de datos antes de la confirmación explícita del usuario.
- Fuentes soportadas: Excel (.xlsx, con selector de hoja si hay varias),
  CSV (detecta el separador automáticamente), texto pegado directamente,
  y PDF (extrae texto y detecta estructura de tabla por posición; si no
  hay confianza suficiente — p. ej. un PDF escaneado sin capa de texto —
  no inventa nada y ofrece pegar el contenido como texto en su lugar).
- Mapeo de columnas con detección automática de sinónimos habituales
  (Ingrediente/Nombre/Producto, Precio/Coste/P. compra, Unidad/Ud./U.M.),
  siempre editable antes de continuar; una columna sin mapear queda
  como "Sin utilizar".
- Cada fila queda en uno de seis estados (Nuevo, Existente, Posible
  duplicado, Actualizar, Error, Ignorar), editable individualmente antes
  de importar: se puede corregir nombre/categoría/unidad/precio, excluir
  una fila o resolver un posible duplicado — nunca se fusiona una
  coincidencia ambigua en automático.
- Reutiliza exactamente el modelo y el mecanismo existentes: un
  ingrediente nuevo crea una fila en `ingredients`, un precio (nuevo o
  actualizado) crea una fila en `purchase_formats` — igual que el alta
  manual. No se creó ninguna tabla, motor de coste ni sistema de precios
  nuevo.
- Escritura transaccional mediante una única función `import_ingredients`
  (RPC): procesa solo las filas aprobadas, determina el negocio siempre
  por la sesión (nunca por el archivo ni por el frontend), y queda sujeta
  a la misma RLS que ya protege ingredients/purchase_formats — incluida
  la exigencia de negocio operativo introducida en SA-3 (un negocio
  suspendido no puede importar).
- Nuevas dependencias: `exceljs` (lectura de .xlsx) y `pdfjs-dist`
  (extracción de texto de PDF), cargadas solo bajo demanda al entrar al
  importador (code-splitting), sin afectar al tamaño de carga del resto
  de la aplicación. Se descartó `xlsx` (SheetJS) por un CVE alto sin
  parche en su versión de npm.
- Riesgo residual aceptado (severidad moderada): `exceljs@4.4.0` trae
  `uuid@8.3.2` como única dependencia transitoria, afectado por
  GHSA-w5hq-g745-h8pq ("missing buffer bounds check en v3/v5/v6 cuando
  se pasa un `buf` externo"). Verificado por inspección del paquete
  fuente y del bundle real de producción: `exceljs` solo destructura
  `v4` de `uuid` (nunca v3/v5/v6) y la llama sin argumentos, en un único
  punto — generación de IDs para reglas de formato condicional
  extendidas al *escribir* un .xlsx. El importador de OídoChef solo
  *lee* archivos (`workbook.xlsx.load()`), nunca escribe — ese camino no
  es alcanzable desde ninguna entrada que acepte el importador. No hay
  fix disponible sin un downgrade con breaking change de `exceljs`; no
  se aplicó ningún downgrade ni override de dependencias.

## V1.3.0

SA-3: ciclo de vida comercial — TRIAL → GRACE → SUSPENDED, y ACTIVE.

- Reglas fijas: trial 14 días, gracia 7 días adicionales, active
  indefinido hasta decisión del Super Admin, suspended bloquea el
  acceso operativo sin borrar ningún dato.
- GRACE nunca se guarda como valor de estado — se calcula en vivo a
  partir de `trial_ends_at`, tanto en el backend (`business_is_operational()`)
  como en el frontend, para que nunca queden desincronizados.
- Bloqueo real (no solo visual): las políticas RLS de escritura de
  ingredientes, recetas, componentes, producciones, categorías y
  formatos de compra ahora exigen que el negocio esté operativo —
  intentar la API directamente también queda rechazado.
- Corregida una vulnerabilidad encontrada en la auditoría: la política
  de auto-edición del negocio (Configuración) no restringía columnas y
  permitía en teoría que un admin normal tocara su propio
  status/fechas de trial por API directa. Nuevo trigger lo bloquea.
- Panel de Super Admin: columnas Trial/Gracia, acciones Activar /
  Suspender / Renovar trial (con confirmación), e historial básico de
  cambios de estado por negocio.
- Pantalla de bloqueo completo para negocios suspendidos, y banner de
  aviso durante el periodo de gracia.
- No incluye todavía expiración/suspensión automática por cron, pagos,
  ni modo soporte — eso pertenece a SA-4 en adelante.

## V1.2.0

SA-2: registro público de negocios + trial de 14 días.

- Pantalla pública `/signup` ampliada: teléfono, confirmación de
  contraseña, y aviso claro de "14 días gratis, sin tarjeta".
- Al registrarse, se crea el negocio en estado `trial` con
  `trial_started_at`/`trial_ends_at` (+14 días exactos) y el usuario
  queda como su único ADMIN — usando el mismo trust boundary que ya
  protegía las invitaciones (el backend decide business_id/role/status,
  nunca el cliente).
- Banner discreto "🟢 Prueba gratuita — Te quedan N días" en el sidebar
  mientras el negocio esté en trial.
- El panel de Super Admin ahora ordena los negocios por fecha de
  creación (más nuevo primero) y marca los registrados en las últimas
  24h como "Nuevo" — el aviso de "negocio nuevo registrado" sin
  depender de correo (limitación conocida: sin infraestructura de email
  propia todavía).
- No incluye todavía expiración/bloqueo automático del trial,
  activación o suspensión manual, pagos, ni modo soporte — eso
  pertenece a SA-3 en adelante.

## V1.1.0

Funcionalidades acumuladas desde V1.0.0 que nunca habían tenido su
propio incremento de versión, más el núcleo de Super Admin (SA-1).

- Eliminación segura de ingredientes y recetas, con verificación de
  dependencias reales y diálogo de confirmación reutilizable.
- Categoría de receta como selector editable y sugerencia automática
  de código de receta, ambos con unicidad por negocio.
- Escandallo consolidado: vista admin con el coste de todas las
  recetas de una vez, reutilizando el motor de costes existente.
- Datos del negocio editables (nombre, teléfono, email, dirección) y
  logo con almacenamiento privado por negocio.
- Gestión de usuarios: eliminar usuario (con verificación de negocio e
  integridad del histórico de producción) y contraseñas — cambio
  propio y reseteo por parte de un administrador vía correo.
- Contador de ingredientes y recetas en el Inicio.
- Redondeo de cantidades en la hoja de producción a múltiplos de 5,
  sin decimales.
- **Núcleo de Super Admin (SA-1)**: nueva capa de administración de
  PLATAFORMA, independiente de los negocios — identidad separada
  (`platform_admins`, sin relación con `business_id`), panel de solo
  lectura en `/super-admin` con el listado y la ficha de cada negocio,
  y el modelo de estado/ciclo de vida del negocio (`trial` / `active`
  / `expired` / `suspended`). No incluye todavía registro público,
  trial automático, activación/suspensión manual, avisos ni modo
  soporte — eso llega en fases posteriores (SA-2 en adelante).

## V1.0.0

Primera versión oficial de V1.

- Ingredientes y formatos de compra, con histórico de precios.
- Recetas y subrecetas (una subreceta es simplemente una receta usada
  como componente de otra, sin entidad propia).
- Motor de costes: coste unitario, por componente, total y por unidad
  de rendimiento, recorriendo cadenas de subrecetas.
- Producción: hoja de producción escalada automáticamente, a partir del
  rendimiento o, si no está definido, de la fórmula base de la receta.
- Vistas Cocina / Costes / Producir / Completa de cada receta.
- Autenticación, negocio y roles (administrador / cocina).
- Aislamiento multi-negocio (Row Level Security en toda la base de datos).
- Impresión / PDF vía el navegador.
- Preparación para despliegue en Cloudflare Pages.
