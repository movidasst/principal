# Entornos independientes de Mi Movida

## Disponible ahora

`npm ci`, `npm run stage:synthetic`, `npm test`. No requiere Supabase alojado, Docker, Moodle ni correo real. PostgreSQL PGlite ejecuta las migraciones de identidad/lectura con roles reales y RLS; Auth y Storage son dobles de prueba. No enlazar este servidor a producción. Los correos `.invalid` se capturan solo en memoria y no se envían.

## Supabase nativo local preparado, pendiente de Docker

Se evaluó el equipo: Docker y WSL no están instalados. No se cambiaron características de Windows, no se instalaron recursos de pago y no se creó proyecto alojado. Supabase CLI oficial 2.122.0 se obtuvo y verificó; sus binarios locales no se versionan.

Tras disponer de Docker Desktop autorizado y activo, desde la raíz:

```powershell
npm run stage:sync
supabase start --workdir ./staging
supabase db reset --local --workdir ./staging
supabase functions serve --workdir ./staging --env-file ./staging/.env.edge
```

`db reset --local` es exclusivamente para el contenedor desechable. Nunca usar `--linked`, `db push`, ni la referencia de producción. El baseline `local_only_business_baseline` solo crea un esquema sintético independiente, **no** es una migración para una base existente. Seed sintético y helpers Desarrolla fixture no replican su motor real.

El sincronizador copia SQL revisado a migraciones timestamp y fuentes Edge a functions. Solo invocarlo antes de la primera instalación de un entorno; tras compartir migraciones aplicadas, generar una nueva migración con CLI para cambios posteriores y no editar historia aplicada. Auth y Storage provienen del runtime nativo; no se recrean sus tablas con el fixture.

Copiar `.env.example` a `.env` local privado y completar valores del contenedor. Generar SESSION_SECRET aleatorio; las claves nativas locales se consultan mediante `supabase status --workdir ./staging` y no se adjuntan a evidencias. Para Edge, archivo privado `staging/.env.edge` con MM_RATE_LIMIT_SECRET y MM_ALLOWED_ORIGINS. Las variables SUPABASE del runtime las proporciona CLI. Ningún secreto al navegador o Git. Ejecutar `node --env-file=.env application/server/app.mjs` para el BFF nativo.

Validación pendiente en ese runtime: bootstrap Auth real y refresh, grants PostgREST, RLS entre dos usuarios, límites y replay, foto propia/ajena y MIME/tamaño, funciones Edge desde consumidores legacy, regresión PIF, parches de ranking con definiciones reales y logout/recovery con JWT anterior. Ejecutar asesores de seguridad de CLI y revisar cada hallazgo antes de promover. Las 42 pruebas actuales no sustituyen estos pasos.

## Moodle y correo

Conservar adaptador simulado hasta contar con Moodle de pruebas autorizado. Configurar MOODLE_BASE_URL/TOKEN en servidor exclusivamente; habilitar funciones mínimas documentadas en ACADEMIA.md para estudiantes ficticios. No usar token académico de producción ni exportar matrículas reales. Resend requiere remitente autorizado o sandbox de prueba; el modo sintético no realiza envíos.

## Alternativa alojada, sin ejecutar

Si Docker no resulta viable o se necesita revisión compartida, evaluar `mi-movida-staging` separado o branching disponible en el plan Supabase. Deben revisarse disponibilidad y precio en la cuenta al decidir; no se presume que sean gratuitos. Antes de crear recursos: autorización de costo, aislamiento, esquema sin datos personales, usuarios ficticios, variables privadas y política de eliminación. No se ha creado ninguno.
