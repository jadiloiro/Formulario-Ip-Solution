# IP Solution — Backend do Onboarding (NestJS)

API + servidor do frontend para o formulário de levantamento e o editor visual do fluxo do BOT.

## Requisitos
- Node.js 18+ (recomendado 20 LTS)

## Como rodar

```bash
cd backend
npm install

# 1) Copie os arquivos do frontend para a pasta public/
#    (index.html, style.css, script.js, flowchart.html, flowchart.css, flowchart.js)
mkdir -p public data
cp ../index.html ../style.css ../script.js ../flowchart.html ../flowchart.css ../flowchart.js public/

# 2) Suba o servidor (modo desenvolvimento com reload automático)
npm run start:dev
```

Abra **http://localhost:3000** — o formulário e o editor já estarão servidos pelo próprio backend, e o frontend detecta a API automaticamente (via `GET /api/health`) e passa a sincronizar com o banco. Sem a API (abrindo os HTML direto do disco), tudo continua funcionando em modo offline com `localStorage`.

O banco é um arquivo SQLite criado automaticamente em `data/ipsolution.db`. Para usar Postgres/MySQL em produção, altere apenas o bloco `TypeOrmModule.forRoot` em `src/app.module.ts`.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status da API (usado pelo frontend para detectar o modo online) |
| POST | `/api/submissions` | Cria um levantamento |
| GET | `/api/submissions` | Lista todos (painel da equipe) |
| GET | `/api/submissions/current` | Retorna o rascunho mais recente (cria um se não existir) |
| GET | `/api/submissions/:id` | Busca por id |
| PATCH | `/api/submissions/:id` | Atualiza parcialmente (`clientName`, `formData`, `flowData`, `status`) |
| PUT | `/api/submissions/:id/flow` | Salva apenas o fluxo visual (usado pelo editor Drawflow) |
| POST | `/api/submissions/:id/submit` | Marca como **enviado** (fim do onboarding) |
| DELETE | `/api/submissions/:id` | Remove |

### Modelo (`Submission`)
```ts
{
  id: string (uuid),
  clientName: string,
  formData: object | null,   // rascunho completo do formulário
  flowData: object | null,   // export do Drawflow (grafo do BOT)
  status: 'rascunho' | 'enviado',
  createdAt: Date,
  updatedAt: Date
}
```

## Estrutura

```
backend/
├── package.json
├── nest-cli.json
├── tsconfig.json
├── data/                    # banco SQLite (criado em runtime)
├── public/                  # frontend servido estaticamente
└── src/
    ├── main.ts              # bootstrap: CORS, ValidationPipe, prefixo /api
    ├── app.module.ts        # TypeORM (SQLite) + ServeStatic + módulos
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts
    └── submissions/
        ├── submissions.module.ts
        ├── submissions.controller.ts
        ├── submissions.service.ts
        ├── entities/submission.entity.ts
        └── dto/
            ├── create-submission.dto.ts
            ├── update-submission.dto.ts
            └── update-flow.dto.ts
```

## Notas de produção
- `synchronize: true` no TypeORM é conveniente em desenvolvimento; em produção, desligue e use migrations.
- Todos os payloads passam pelo `ValidationPipe` global (`whitelist` + `transform`) com regras de `class-validator` nos DTOs.
- CORS está liberado para facilitar o desenvolvimento; restrinja `enableCors` aos domínios da IP Solution em produção.

## Deploy em produção (Proxmox ou VM separada)

Os passos abaixo são **os mesmos** independente de a máquina ser uma VM dentro de um cluster Proxmox ou uma VM separada em outro provedor/hypervisor — a única diferença fica na etapa de provisionar a VM em si (criar o recurso no Proxmox vs. já ter a VM pronta). Depois disso é só um Debian/Ubuntu comum.

### 0. Provisionar a VM
- Debian 12/13 (ou Ubuntu 22.04+), 1-2 vCPU, 1-2 GB RAM já é suficiente para esta API.
- IP fixo (estático ou reserva de DHCP) na rede interna — é esse IP que o Nginx "de borda" (edge) vai usar como upstream.
- Acesso SSH como root (ou usuário com sudo).

### 1. Dependências do sistema

```bash
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL
apt install -y postgresql

# PM2 (gerenciador de processos usado para manter a API no ar)
npm install -g pm2

# Nginx (reverse proxy / TLS)
apt install -y nginx
```

### 2. Banco de dados

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'defina-uma-senha-forte';"
sudo -u postgres psql -c "CREATE DATABASE ipsolution OWNER postgres;"
```
> Prefira criar um usuário dedicado (`CREATE USER ipsolution ...`) em vez de usar `postgres` diretamente, caso o ambiente exija segregação de privilégios.

### 3. Código da aplicação

```bash
mkdir -p /opt/ipsolution
cd /opt/ipsolution
git clone <repo> backend    # ou copie os arquivos via scp/rsync
cd backend

cp .env.example .env
# edite o .env com os dados reais:
#   DB_HOST=localhost
#   DB_PORT=5432
#   DB_USERNAME=postgres
#   DB_PASSWORD=<senha definida no passo 2>
#   DB_DATABASE=ipsolution
#   PORT=3000
#   NODE_ENV=production

npm ci
npm run build          # gera dist/main.js
npm run migration:run  # cria/atualiza as tabelas
```

### 4. Subir o serviço com PM2

O `ecosystem.config.js` já está no repo e aponta para `dist/main.js`:

```bash
cd /opt/ipsolution/backend
pm2 start ecosystem.config.js
pm2 save                # persiste a lista de processos
pm2 startup             # gera e habilita o serviço systemd que religa o PM2 no boot
```

Comandos úteis:
```bash
pm2 status                        # ver se está "online"
pm2 logs ipsolution-backend       # acompanhar logs (também em /var/log/pm2/)
pm2 restart ipsolution-backend    # reiniciar após novo deploy
```

> Alternativa sem PM2: existe um unit file pronto em `deploy/ipsolution.service` para rodar via `systemd` puro. Veja `deploy/README.md` para esse caminho.

### 5. Nginx — proxy reverso e HTTPS

A API sobe apenas em `127.0.0.1:3000` (não deve ficar exposta direto na rede). O Nginx local é quem expõe as portas 80/443 e repassa para a porta 3000. Exemplo (`/etc/nginx/sites-available/<dominio>`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name SEU_DOMINIO_OU_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Necessário apenas se esta VM recebe tráfego HTTPS diretamente,
# ou se está atrás de um Nginx "de borda" que reencripta até aqui (proxy_pass https://...).
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name SEU_DOMINIO_OU_IP;

    # Certificado real (Let's Encrypt/comprado) se esta VM for a borda pública.
    # Se for só o hop interno edge -> esta VM, o self-signed do próprio Debian já basta:
    ssl_certificate     /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/<dominio> /etc/nginx/sites-enabled/
usermod -aG ssl-cert www-data   # necessário se usar o certificado self-signed acima
nginx -t && systemctl restart nginx
```

Se esta VM for apenas o **backend interno** de uma topologia com um Nginx de borda em outra máquina (proxy com TLS re-encriptado), garanta que o `upstream`/`proxy_pass` de lá aponte para o IP desta VM na porta 443 — é exatamente essa combinação que evita o erro `502 Bad Gateway`.

### 6. Checklist de verificação

```bash
pm2 status                                          # ipsolution-backend "online"
curl http://localhost:3000/api/health               # API respondendo direto
curl -k https://localhost/                          # via Nginx/HTTPS local
nginx -t                                            # config sem erros
systemctl status nginx postgresql                   # ambos ativos
```

### 7. Atualizando após novo deploy

```bash
cd /opt/ipsolution/backend
git pull                 # ou copie os arquivos novos
npm ci
npm run build
npm run migration:run
pm2 restart ipsolution-backend
```
