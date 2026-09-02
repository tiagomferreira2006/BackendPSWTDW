# Backend — Plataforma Multi-Oficina

API REST em **Node.js + ExpressJS**, com persistência em **MongoDB** através do **Mongoose**, e autenticação por **JWT**.

## 1. Requisitos

- Node.js LTS (`node -v` para confirmar)
- Uma instância de MongoDB — local (MongoDB Community Server) **ou** [MongoDB Atlas](https://www.mongodb.com/) (cluster grátis)

## 2. Configuração

```bash
cd backend
npm install
```

> **Nota:** este projeto já inclui um ficheiro `.env` pré-preenchido para uso
> local imediato (MongoDB local, `JWT_SECRET` já definido). Só precisa de o
> editar se for usar o MongoDB Atlas em vez de um MongoDB local — nesse caso,
> substitua o `MONGO_URL`. Se preferir começar do zero: `cp .env.example .env`.

Conteúdo esperado do `.env`:

```
PORT=4000
MONGO_URL=mongodb://localhost:27017        # ou a connection string do Atlas
MONGO_DB_NAME=oficina_platform
JWT_SECRET=um_segredo_forte_e_aleatorio
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

## 3. Popular a base de dados com dados de demonstração (opcional mas recomendado)

```bash
node seed.js
```

Isto cria uma oficina completa (serviços, 2 mecânicos, 4 clientes com veículos, e ~25 marcações passadas/futuras para o dashboard ter dados). No final mostra as credenciais no terminal, entre as quais a **conta de demonstração do Admin Oficina**:

```
Email:    admin@oficinacentral.pt
Password: demo1234
```

## 4. Correr o servidor

```bash
npm run dev     # com nodemon (recarrega automaticamente)
# ou
npm start
```

A API fica disponível em `http://localhost:4000`.

## 5. Estrutura do projeto

```
backend/
  index.js              # arranque do servidor, ligação à BD, registo das rotas
  models/                # Schemas Mongoose (1 por recurso)
  controllers/            # Rotas/endpoints agrupados por recurso (express.Router)
  middleware/auth.js      # autenticar() valida o JWT · autorizar(...roles) valida o perfil
  utils/jwt.js            # geração do token
  seed.js                 # dados de demonstração
  tests/test-e2e.js       # script manual de teste ao fluxo completo da API
```

## 6. Principais endpoints

| Recurso | Endpoints |
|---|---|
| Auth | `POST /auth/register/cliente`, `POST /auth/register/oficina`, `POST /auth/login`, `GET /auth/me` |
| Oficinas | `GET /oficinas`, `GET /oficinas/:id`, `PATCH /oficinas/:id` |
| Staff | `GET/POST /oficinas/:id/staff`, `PATCH/DELETE /oficinas/:id/staff/:staffId` |
| Serviços | `GET /servicos`, `POST /servicos`, `PATCH/DELETE /servicos/:id` |
| Veículos | `GET/POST /veiculos`, `PATCH/DELETE /veiculos/:id` |
| Turnos | `GET /turnos`, `POST /turnos`, `PATCH/DELETE /turnos/:id` |
| Marcações | `POST /marcacoes`, `GET /marcacoes`, `PATCH /marcacoes/:id/estado`, `PATCH /marcacoes/:id/cancelar` |
| Dashboard (Admin) | `GET /dashboard/:oficinaId?dias=30` |

A autenticação é feita por **JWT**: depois do login, enviar o token no header `Authorization: Bearer <token>` em todos os pedidos protegidos. O `role` de cada utilizador (`admin_oficina` \| `mecanico` \| `cliente`) determina a que endpoints tem acesso (ver `middleware/auth.js`).

## 7. Testar rapidamente (sem frontend)

Com o servidor a correr numa consola, noutra consola:

```bash
node tests/test-e2e.js
```

Este script percorre o fluxo completo (registo de oficina → serviço → mecânico → turno → registo de cliente → veículo → marcação → validações de vagas → estado → dashboard) e imprime o resultado de cada passo.
