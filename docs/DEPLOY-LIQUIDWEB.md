# Despliegue en Liquid Web (VPS)

Arquitectura en produccion:

```
Internet -> Nginx (443, TLS) -> PM2 -> Node/Fastify (:3001)
                                         |-- /api/*  -> API
                                         '-- /*      -> build estatico del juego
```

La API sirve tambien el cliente compilado, asi que **solo hay un proceso** que mantener.

---

## 1. Preparar el servidor (una sola vez)

```bash
ssh usuario@TU_IP_LIQUIDWEB

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

# PM2
sudo npm install -g pm2

# Usuario sin privilegios para la app
sudo adduser --system --group --home /var/www/tito tito
sudo mkdir -p /var/www/tito && sudo chown -R tito:tito /var/www/tito
```

## 2. Clonar y configurar

```bash
sudo -u tito -H bash
cd /var/www/tito
git clone TU_REPO_GIT .

npm ci
cp .env.production.example .env
nano .env      # valores de PRODUCCION
```

`.env` de produccion:

```env
NODE_ENV=production
API_PORT=3006
API_HOST=127.0.0.1
CORS_ORIGINS=https://tito.systemdem.online

JWT_SECRET=<48 bytes aleatorios>
SCORE_HMAC_SECRET=<48 bytes aleatorios>

DATABASE_URL=<Neon branch production, pooled>
DIRECT_URL=<Neon branch production, direct, sin -pooler>

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
AI_ENABLED=true

VITE_API_URL=
VITE_SCORE_HMAC_SECRET=<mismo valor que SCORE_HMAC_SECRET>
VITE_GAME_VERSION=1.0.0
```

> `VITE_API_URL` vacio hace que el cliente use rutas relativas (`/api/...`),
> que es justo lo que queremos cuando Nginx y la API comparten dominio.

## 3. Compilar y migrar

```bash
npm run build
npm run db:deploy --workspace @tito/api
npm run db:seed
```

## 4. Arrancar con PM2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
exit                      # volver a tu usuario con sudo
sudo pm2 startup systemd -u tito --hp /var/www/tito
```

Comandos utiles: `pm2 status`, `pm2 logs tito-api`, `pm2 reload tito-api`.

## 5. Nginx + TLS

```bash
sudo cp /var/www/tito/deploy/nginx-tito.conf /etc/nginx/sites-available/tito
sudo ln -s /etc/nginx/sites-available/tito /etc/nginx/sites-enabled/tito
sudo nano /etc/nginx/sites-available/tito     # dominio: tito.systemdem.online
sudo nginx -t && sudo systemctl reload nginx

# Certificado gratuito
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tito.systemdem.online
```

## 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

El puerto 3006 **no** se expone: solo escucha en `127.0.0.1`.

---

## Actualizar la version

```bash
sudo -u tito -H bash -c 'cd /var/www/tito && \
  git pull && \
  npm ci && \
  npm run build && \
  npm run db:deploy --workspace @tito/api && \
  pm2 reload tito-api'
```

---

## Checklist post-despliegue

- [ ] `curl https://tito.systemdem.online/api/health` responde `"status":"healthy"`
- [ ] El juego carga en el navegador y se ve el logo
- [ ] Registro e inicio de sesion funcionan
- [ ] Al terminar un nivel aparece en la tabla de posiciones
- [ ] `pm2 logs tito-api` sin errores
- [ ] Certificado TLS valido (candado en el navegador)
- [ ] Backups de Neon activados (Point-in-time restore)
