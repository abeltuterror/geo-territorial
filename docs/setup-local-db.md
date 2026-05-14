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

### 4. Crear tablas y cargar vendedores
```bash
npx prisma migrate dev --name init
```

Este comando hace 3 cosas automáticamente:
1. Crea todas las tablas en la BD según `prisma/schema.prisma`
2. Registra la migración en `prisma/migrations/`
3. Corre el seed (`prisma/seed.ts`) que inserta los 90 vendedores

### 5. Verificar
```bash
sudo -u postgres psql -d geo_territorial -c "\dt"
```

Deberías ver:
```
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | sellers         | table | geo_user
 public | sales_points    | table | geo_user
 public | territories     | table | geo_user
 public | _prisma_migrations | table | geo_user
```

## Comandos útiles

```bash
# Entrar a la BD
psql -U geo_user -d geo_territorial -h localhost

# Ver tablas
\dt

# Ver vendedores cargados
SELECT COUNT(*) FROM sellers;

# Abrir Prisma Studio (UI visual de la BD)
npm run db:studio

# Resetear la BD (borra todo y vuelve a empezar)
npx prisma migrate reset --force
```
