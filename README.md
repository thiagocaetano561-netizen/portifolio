# TRYGGPORT DEV — PORTFÓLIO

Portfólio profissional da **Tryggport Dev** com dois modos de navegação (visual e terminal)
e uma camada narrativa oculta — seis capítulos, um arco paralelo de pistas espalhadas pelo
portfólio visual, dicas graduais, quatro finais e 32 easter eggs — cuja lógica e conteúdo vivem
**exclusivamente no servidor**.

> **Windows:** se o PowerShell bloquear `npm` ("a execução de scripts foi desabilitada"),
> use `npm.cmd` no lugar de `npm` (ex.: `npm.cmd run dev`).

- **Next.js 16** (App Router, `proxy.ts`) · **React 19** · **TypeScript**
- **PostgreSQL** (produção) / **PGlite** (PostgreSQL em WebAssembly, apenas dev e testes) · **Drizzle ORM**
- **Tailwind CSS 4** · **Motion** · **Zod**
- **Vitest** (unidade + integração) · **Playwright** (end-to-end)

Sem painel administrativo, sem CMS, sem login de administrador e sem endpoints administrativos.

---

## Começando

```bash
npm install
```

```bash
npm run secrets:generate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

`secrets:generate` cria `.env.local` com chaves aleatórias (nunca sobrescreve um arquivo existente).
`db:seed` aplica as migrações e provisiona a narrativa a partir da pasta privada `narrative/`.
Em desenvolvimento o banco é um PGlite em `./.data/pglite` — não é preciso instalar PostgreSQL.

> **A pasta `narrative/` é privada.** Ela contém a história completa e as soluções, está no
> `.gitignore` e nunca deve ir para um repositório público. Faça backup dela separadamente.
> Sem ela, o portfólio e o terminal público funcionam normalmente; apenas a camada narrativa fica vazia.

## Editando o conteúdo público

| O quê | Onde |
|---|---|
| Projetos (nome, descrição, tecnologias, URL, status do link, imagem) | [src/content/projects.ts](src/content/projects.ts) |
| Sobre, princípios, contatos, tecnologias | [src/content/site.ts](src/content/site.ts) |
| Comandos públicos do terminal e manual | [src/lib/terminal/public-commands.ts](src/lib/terminal/public-commands.ts) |
| Logotipo original | [assets/brand/tryggport-original.jpg](assets/brand/tryggport-original.jpg) → `npm run assets` |
| Capturas reais dos projetos | [assets/projects/](assets/projects) → `npm run assets` (gera WebP em `public/projects`) |
| Vídeos cinematográficos (opcionais) | [src/content/media.ts](src/content/media.ts) + arquivos em `public/media/` |

Para **adicionar um projeto**, acrescente um objeto em `projects`. O status `linkStatus`
controla o botão: `online` mostra "Visitar projeto", `unavailable` e `pending` mostram a observação.
Somente URLs `https://` de projetos `online` viram links — inclusive no terminal.
`highlights` e `technologies` devem conter apenas o que foi verificado no projeto publicado.

### Vídeos cinematográficos (Higgsfield)

Gerados com o MCP da Higgsfield em 13/11/2026: para cada cena, um quadro-chave (GPT Image 2.6) foi
usado como **primeiro e último quadro** de um vídeo Cinema Studio Video 3.0, o que produz um loop sem
corte. Todos foram revisados (sem texto, logos, pessoas ou escudos) e são apenas decorativos.

| Recurso | Uso |
|---|---|
| `hero` | fundo da primeira tela (1080p, 8 s) |
| `logo` | filamentos de luz que emolduram a marca (o símbolo em si é o SVG fiel ao logotipo) |
| `boot` | fundo da inicialização do terminal (o texto continua interativo por cima) |
| `void` | cena "ambiente misterioso" dos eventos narrativos |
| `fendalume`, `fc26` | luz ambiente conceitual atrás das capturas reais (rotulada como conceitual) |

Pipeline: originais em `assets/media/source/` (fora do git) →
`node scripts/process-media.mjs` → `public/media/<nome>.{webm,mp4,webp}` (VP9 + H.264 sem áudio,
poster WebP). Registro em [src/content/media.ts](src/content/media.ts). Os vídeos só carregam quando
visíveis, pausam fora da tela e não tocam com movimento reduzido, economia de dados ou (exceto a cena
narrativa) em telas pequenas — nesses casos aparece o poster estático. A CSP só aceita mídia do próprio site.

### Pendências do proprietário

- **Contatos** — `site.contact` está vazio; a seção mostra "em breve" até você adicionar links reais.
- **Tecnologias do FC 26 Random Match** — não puderam ser verificadas publicamente; preencha se quiser.
- **Fendalume** — o endereço antigo `fendalume.vercel.app` responde 404; o site usa `fendalume.online`
  (verificado em 13/11/2026).

## Scripts

| Script | Função |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento, build de produção, servidor |
| `npm run db:migrate` | aplica migrações SQL versionadas |
| `npm run db:seed` | provisiona capítulos, desafios, arquivos virtuais, regras e eggs (respostas → HMAC) |
| `npm run db:prune` | remove sessões expiradas e dados antigos (agende diariamente) |
| `npm test` | testes unitários e de integração (inclui os testes privados em `narrative/`, se existirem) |
| `npm run test:e2e` | Playwright contra um build de produção local |
| `npm run audit:bundle` | procura segredos e sourcemaps nos artefatos públicos do build |
| `npm run audit:deps` | `npm audit` das dependências de produção |
| `npm run verify` | typecheck + testes + build + auditoria do bundle |
| `npm run assets` | gera marca, ícones e imagem Open Graph a partir do logotipo |

## Deploy em produção

1. **PostgreSQL independente** (Neon, RDS, Railway, servidor próprio…), com SSL.
   Crie um usuário da aplicação com permissão apenas no banco do site.
2. **Variáveis de ambiente** no provedor (nunca com prefixo `NEXT_PUBLIC_`):

   | Variável | Valor |
   |---|---|
   | `SITE_URL` | `https://seu-dominio` |
   | `DATABASE_DRIVER` | `pg` |
   | `DATABASE_URL` | `postgres://…?sslmode=require` |
   | `PUZZLE_HMAC_KEY` | 32+ bytes aleatórios em base64, **diferente** do de desenvolvimento |
   | `IP_HASH_KEY` | 24+ bytes aleatórios |
   | `TRUST_PROXY` | `true` (Vercel ou outro proxy confiável que define `X-Forwarded-For`) |

   A aplicação **recusa iniciar** em produção sem PostgreSQL real, sem chaves fortes, sem HTTPS
   ou sem `TRUST_PROXY=true` (ver [src/server/env.ts](src/server/env.ts)).
3. **Migrar e provisionar a narrativa a partir da sua máquina** (a pasta `narrative/` não vai para o deploy):

   ```bash
   DATABASE_DRIVER=pg DATABASE_URL="postgres://…" PUZZLE_HMAC_KEY="<a mesma chave de produção>" npm run db:seed
   ```

   O seed é idempotente para o conteúdo e não altera o progresso dos visitantes.
   Trocar `PUZZLE_HMAC_KEY` exige rodar o seed de novo.
4. **Deploy** (ex.: Vercel conectada ao repositório). Build: `npm run build`.
5. **Manutenção**: agende `npm run db:prune` (cron diário) ou um job SQL equivalente.

Mais detalhes: [docs/architecture.md](docs/architecture.md) · [docs/threat-model.md](docs/threat-model.md) ·
[docs/security-audit.md](docs/security-audit.md).

## Limites honestos

Nenhum site é impossível de invadir. O objetivo aqui é impedir vazamentos evitáveis e proteger o
conteúdo ainda não liberado contra visitantes e contra as técnicas do modelo de ameaças (inspeção do
navegador, repetição e manipulação de requisições, automação). Quem tiver acesso autorizado ao código
privado, ao banco ou à infraestrutura consegue ver tudo — esses acessos precisam ser controlados
operacionalmente.
