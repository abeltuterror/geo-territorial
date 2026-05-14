# Setup Base de Datos Local

## Requisitos
- PostgreSQL 16 instalado y corriendo
- PostGIS instalado

## Pasos

### 1. Instalar PostGIS
```bash
sudo apt-get install -y postgresql-16-postgis-3
```

### 2. Crear base de datos y usuario
```bash
sudo -u postgres psql -c "CREATE DATABASE geo_territorial;"
sudo -u postgres psql -c "CREATE USER geo_user WITH PASSWORD 'geo123' SUPERUSER;"
sudo -u postgres psql -d geo_territorial -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 3. Configurar variables de entorno
Crear archivo `.env` en la raíz del proyecto:
```env
DATABASE_URL="postgresql://geo_user:geo123@localhost:5432/geo_territorial"
```

Crear archivo `.env.local` en la raíz del proyecto:
```env
DATABASE_URL="postgresql://geo_user:geo123@localhost:5432/geo_territorial"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
NEXT_PUBLIC_MAP_PROVIDER="maplibre"
```

### 4. Colocar el archivo de datos
Copiar el Excel en:
```
prisma/data/puntos.xlsx
```

### 5. Crear tablas y cargar todos los datos
```bash
npx prisma migrate reset --force
```

Este comando hace todo automáticamente:
1. Crea las tablas en la BD según `prisma/schema.prisma`
2. Corre `prisma/seed.ts` que lee `puntos.xlsx` y carga:
   - 90 vendedores (hoja "Vendedores")
   - 18 763 puntos de venta (hoja "Geo puntos")

### 6. Verificar
```bash
psql postgresql://geo_user:geo123@localhost:5432/geo_territorial -c "\dt"
```

Deberías ver:
```
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+----------
 public | _prisma_migrations | table | geo_user
 public | puntos_venta       | table | geo_user
 public | spatial_ref_sys    | table | geo_user
 public | territorios        | table | geo_user
 public | vendedores         | table | geo_user
```

> **`spatial_ref_sys`** es una tabla interna de PostGIS. Se crea automáticamente al activar la extensión y no pertenece al proyecto — no la toques.

## Comandos útiles

```bash
# Entrar a la BD
psql postgresql://geo_user:geo123@localhost:5432/geo_territorial

# Ver tablas
\dt

# Ver columnas de una tabla
\d vendedores
\d puntos_venta
\d territorios

# Contar registros
SELECT COUNT(*) FROM vendedores;
SELECT COUNT(*) FROM puntos_venta;

# Abrir Prisma Studio (UI visual de la BD)
npm run db:studio

# Resetear la BD completa (borra todo y recarga desde el Excel)
npx prisma migrate reset --force
```
