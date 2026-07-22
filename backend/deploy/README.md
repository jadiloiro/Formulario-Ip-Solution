# Deploy nativo (Debian, sem Docker)

Postgres e a API rodam direto na VM, ambos falando via `localhost`.

## 1. Postgres

```bash
sudo apt update
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER ipsolution WITH PASSWORD 'troque-esta-senha';"
sudo -u postgres psql -c "CREATE DATABASE ipsolution OWNER ipsolution;"
```

## 2. Node.js (v20 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Aplicação

```bash
sudo mkdir -p /opt/ipsolution
sudo chown $USER:$USER /opt/ipsolution
git clone <repo> /opt/ipsolution
cd /opt/ipsolution/backend

cp .env.example .env
# Editar .env: DB_HOST=localhost, DB_USERNAME=ipsolution, DB_PASSWORD=<a mesma senha>,
# DB_DATABASE=ipsolution, NODE_ENV=production, PORT=3000

npm ci
npm run build
npm run migration:run   # cria a tabela submissions (uma vez, ou toda vez que houver migration nova)
```

## 4. Rodar como serviço (systemd)

```bash
sudo useradd --system --no-create-home ipsolution   # usuário de serviço, sem login
sudo chown -R ipsolution:ipsolution /opt/ipsolution

sudo cp deploy/ipsolution.service /etc/systemd/system/ipsolution.service
# Ajustar WorkingDirectory/EnvironmentFile no arquivo se o caminho não for /opt/ipsolution/backend

sudo systemctl daemon-reload
sudo systemctl enable --now ipsolution
sudo systemctl status ipsolution
```

Testar: `curl http://localhost:3000/api/health`

## Atualizando depois de um novo deploy

```bash
cd /opt/ipsolution && git pull
cd backend && npm ci && npm run build && npm run migration:run
sudo systemctl restart ipsolution
```

## docker-compose.yml (alternativa, não usada neste deploy)

Segue no repo como opção para subir só o Postgres em dev (`docker compose up -d postgres`)
sem instalar nada localmente. Não é o caminho usado na VM.
