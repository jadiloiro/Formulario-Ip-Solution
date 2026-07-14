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
