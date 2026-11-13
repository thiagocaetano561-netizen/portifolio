# Arquitetura e registro de decisões

Registro compacto para quem (pessoa ou IA) continuar o projeto.

## Visão geral

```
navegador ──► proxy.ts (CSP com nonce) ──► páginas (SSR dinâmico, conteúdo público)
    │
    └──► POST /api/terminal ┐
         POST /api/signal   ┴─► http/handler (origem, corpo, limites, sessão)
                                   └─► terminal/engine (transação por comando)
                                          ├─ parser (sem shell, sem eval)
                                          ├─ builtins públicos + VFS público
                                          ├─ desafios (HMAC, pré-requisitos, tentativas)
                                          ├─ regras narrativas (do banco)
                                          └─ progressão (flags, desbloqueios, descobertas)
                                   PostgreSQL ◄── seed ◄── narrative/ (privado)
```

## Estrutura

| Caminho | Conteúdo | Vai ao navegador? |
|---|---|---|
| `src/content/` | projetos e textos públicos | sim |
| `src/lib/terminal/` | contrato da API, comandos públicos, cliente HTTP, respostas offline | sim |
| `src/components/` | interface (portfólio, terminal, experiência) | sim |
| `src/server/` | env, banco, segurança, sessões, motor, seed — todos com `import "server-only"` | **não** |
| `narrative/` | história, soluções, testes privados (fora do git) | **não** (nem no deploy) |
| `scripts/` | migrate, seed, prune, auditoria do bundle, assets | não |

## Decisões

1. **Conteúdo narrativo só no banco.** O app em execução nunca importa `narrative/`. O seed converte a
   narrativa em linhas (`challenges`, `virtual_files`, `command_rules`, `unlock_rules`, `easter_eggs`).
   Comandos secretos não existem no código-fonte do app — nem no servidor.
2. **Respostas como verificadores HMAC-SHA256** (`tryggport/v1 ‖ id do desafio ‖ resposta normalizada`),
   comparados em tempo constante. Um vazamento somente-leitura do banco não revela respostas.
3. **Normalização por tipo** (`word`, `phrase`, `number`, `time`, `hex`, `list`, `choice`) compartilhada
   entre seed e execução: aceita variações de acento/caixa sem aceitar respostas diferentes. `list`
   preserva a ordem (a ordem faz parte da resposta).
4. **Motor genérico orientado a dados.** Um comando é resolvido nesta ordem: desafios abertos →
   regra `replace` → builtin público → falha do desafio → "comando não encontrado". Regras `prepend`/
   `append` decoram a saída; `complete` libera autocompletar. Comandos bloqueados respondem
   exatamente como comandos inexistentes.
5. **Progresso = flags por sessão.** `unlock_rules` aplicam desbloqueios até estabilizar. Cada solução
   adiciona `solved:<id>`. Toda execução roda numa transação com `SELECT … FOR UPDATE` na sessão
   (serializa requisições concorrentes) e conclusões usam chave primária composta + `ON CONFLICT DO NOTHING`.
6. **Sequências reais**: `required_actions` exige comandos anteriores registrados no `command_log`.
7. **Sessões anônimas**: token de 256 bits no cookie (`__Host-tp_sid` em produção, `HttpOnly`, `Secure`,
   `SameSite=Lax`); o banco guarda apenas o SHA-256. Cookie inválido ⇒ sessão nova e vazia.
8. **Limites no PostgreSQL** (janela fixa atômica via `INSERT … ON CONFLICT … RETURNING`): funciona com
   várias instâncias sem Redis. IPs são anonimizados com HMAC. Falhas de resposta somam por sessão
   e por IP (impede trocar de cookie para burlar limites).
9. **CSP estrita com nonce** por requisição (`script-src 'self' 'nonce-…' 'strict-dynamic'`), por isso
   as páginas são dinâmicas (`connection()`). APIs têm `default-src 'none'` e `no-store`.
10. **PGlite em dev/testes**: PostgreSQL real em WebAssembly, sem instalação. Produção exige `pg`.
11. **Sinais da interface** (`konami`, `logo_burst`, `footer_glyph`, `idle`, `lost`) são genéricos: o
    navegador só informa que um gesto ocorreu; o significado (se houver) é uma regra no banco.
12. **Boot**: primeira visita usa o próprio terminal em tela cheia (mesmo componente que depois vira o
    terminal do hero, via animação de layout). `localStorage` evita repetir; uma classe aplicada antes
    da pintura evita flash.
13. **Migrações SQL próprias** (`src/server/db/migrations.ts`) em vez de drizzle-kit: menos dependências
    de desenvolvimento (o drizzle-kit trazia um esbuild com aviso de segurança) e controle total do SQL.

## Redesign 1.1 (13/11/2026)

14. **Pistas da interface autorizadas pelo servidor** — `POST /api/ui` devolve apenas os slots
    (`hero.indicator`, `hero.glyphs`, `footer.log`, `beacons.state`) cujas regras `ui:<slot>` a sessão
    já satisfez. Nunca cria sessão; visitantes casuais nem chamam a rota (marca local `tp_active`,
    não sensível). Mudanças de flags emitem o evento `ui` e o cliente recarrega os slots.
15. **Pistas públicas são inertes** — os sinais luminosos das seções (contagem + forma, com texto
    acessível) estão no bundle por design; o significado, os comandos e as respostas só existem no banco.
16. **Dicas graduais** — comando público `hint`; até 3 níveis por enigma aberto (`challenges.hints`),
    registrados em `hint_usage`. O nível seguinte libera após 120 s ou 2 tentativas erradas. O lint do
    seed recusa dicas que contenham a resposta.
17. **Novos eventos** — `discovery` (arquivo/conexão/memória), `scene` (ambiente misterioso) e `ui`;
    o terminal mostra banners e digitação animada nas falas de LYS.
18. **Mídia controlada pela aplicação** — `src/content/media.ts` registra vídeos opcionais servidos pelo
    próprio domínio (`media-src 'self'`). Fallback nativo: cena em canvas (~30 fps, pausa fora da
    tela, estática com movimento reduzido) e marca vetorizada do logotipo original (traço → preenchimento).
19. **Projetos com capturas reais datadas** — capturas da aplicação publicada (13/11/2026), sem marcas de
    terceiros na imagem escolhida; destaques limitados ao que foi observado.
20. **Desempenho** — o título do hero não usa fade (opacidade 0 atrasava o LCP); apenas movimento.

21. **Vídeos Higgsfield em loop real** — quadro-chave (GPT Image 2.6) usado como primeiro e último
    quadro do vídeo (Cinema Studio Video 3.0). Quando o modelo não fecha o loop (FC 26), o pipeline
    faz ida e volta. Fundos de projeto são pré-desfocados no encode (filtro CSS sobre vídeo custa caro).

## Estado (13/11/2026)

- v1.1: 56 testes Vitest e 24 testes Playwright (inclui acessibilidade, vídeos e e2e privados);
  auditoria do bundle limpa; `npm audit` sem vulnerabilidades. Vídeos Higgsfield integrados.
- Pendências do proprietário: links de contato; tecnologias do FC 26.
- Ideias futuras (não implementadas de propósito): persistência entre dispositivos (exigiria conta
  opcional — a tabela `sessions` já isola o progresso por identificador opaco, então bastaria
  associar sessões a um usuário).
