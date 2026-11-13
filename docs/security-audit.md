# Auditoria de segurança (Fase 12)

Executada em 13/11/2026 apenas no ambiente próprio do projeto (build de produção local + PGlite).
Comandos: `npm test`, `npm run test:e2e`, `npm run audit:bundle`, `npm audit`.

| # | Verificação | Como foi testado | Resultado |
|---|---|---|---|
| 1 | Inspecionar revela respostas? | e2e privado captura HTML/JS/CSS/RSC/JSON da sessão e procura todas as respostas e trechos de documentos futuros | ✅ nada encontrado |
| 2 | Bundle contém conteúdo secreto? | `audit:bundle` varre `.next/static`, HTML/RSC e `public/` com termos derivados da narrativa | ✅ limpo |
| 3 | Network permite acessar capítulos futuros? | `cat` de arquivos de capítulos futuros e `ls -a /` em sessão nova | ✅ "inexistente" |
| 4 | APIs aceitam desbloqueio não autorizado? | comandos de capítulos futuros com a resposta correta em sessão nova | ✅ idênticos a comando inexistente; nenhuma flag criada |
| 5 | Alterar cookies modifica progresso? | cookie truncado, com 1 caractere trocado, com SQL, com 5 KB | ✅ sessão nova e vazia |
| 6 | SQL Injection | payloads em comandos, argumentos, respostas e cookie | ✅ tratados como texto; tabelas intactas |
| 7 | XSS pelo terminal | `<img onerror>`, `<script>` via `echo` no navegador real | ✅ texto puro, nenhum elemento criado, nenhum diálogo |
| 8 | Operações reais do sistema | `curl`, `ssh`, `rm -rf`, `kill`, `cat /etc/passwd`, `cat .env` | ✅ respostas fictícias, nada executado |
| 9 | Caminhos virtuais acessam arquivos locais? | `../../../../etc/passwd`, `..\`, `%2e%2e`, `/proc/self/environ` | ✅ VFS em memória; rejeitado ou inexistente |
| 10 | Erros revelam ambiente? | falha forçada de tabela durante requisição | ✅ `{"error":"erro interno — tente novamente"}` |
| 11 | Configuração pública? | GET em `/.env`, `/.env.local`, `/package.json`, `/narrative/index.ts`, `/src/...` | ✅ 404 |
| 12 | Sourcemaps expostos? | `audit:bundle` | ✅ nenhum `.map` publicado |
| 13 | Sessões acessam progresso alheio? | duas sessões e dois contextos de navegador | ✅ isoladas |
| 14 | Automação contorna limites? | 8 falhas ⇒ bloqueio mesmo com resposta certa; falhas somadas entre 12 sessões do mesmo IP; limites por sessão, IP e criação de sessão | ✅ 429 / bloqueio |
| 15 | Requisições concorrentes criam estado inválido? | 12 soluções simultâneas da mesma resposta | ✅ exatamente 1 conclusão |
| 16 | Projetos privados/não publicados expostos? | URL de configurações da Vercel ausente do HTML; FC 26 sem URL pública | ✅ |
| 17 | Links externos seguros? | só `https:`/`mailto:` sem credenciais; `rel="noopener noreferrer"`; terminal só linka destinos configurados | ✅ |
| 18 | Funciona com JS limitado? | Playwright com JavaScript desativado em `/terminal` | ✅ portfólio completo, terminal não cobre o conteúdo |
| 19 | Dependências vulneráveis? | `npm audit` | ✅ 0 vulnerabilidades |
| 20 | Deploy expõe dados internos? | `poweredByHeader: false`; `env.ts` falha fechado; `narrative/` excluída do tracing; segredos sem `NEXT_PUBLIC_` | ✅ |

Também verificado: CSP com nonce único por requisição, sem `'unsafe-inline'` em `script-src`;
cabeçalhos `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; nenhum erro ou
violação de CSP no console; `GET` nas APIs ⇒ 405.

## Regressão do redesign 1.1 (13/11/2026)

| Verificação | Resultado |
|---|---|
| `/api/ui` sem sessão | ✅ `{ slots: {} }`, nenhum cookie emitido; corpo com campos extras ⇒ 400; outra origem ⇒ 403; GET ⇒ 405 |
| Pistas da interface antes da autorização | ✅ e2e privado: registro do rodapé, luzes acesas e sequência de formas só aparecem depois das ações certas, nessa ordem |
| Bundle após o redesign | ✅ `audit:bundle` limpo (32 arquivos × 160 termos). Um falso positivo (coordenadas do SVG da marca coincidindo com uma variante de resposta) levou à remoção dessa variante |
| Dicas | ✅ só para enigmas abertos; o seed recusa dicas com a resposta; espera entre níveis |
| CSP | ✅ única mudança: `media-src 'self'` (antes `'none'`) para vídeos locais; nenhum domínio externo |
| Integração externa | ✅ Higgsfield não conectada — nada foi enviado a serviços de mídia; capturas dos projetos feitas apenas das páginas públicas |
| Acessibilidade (axe, WCAG 2.x A/AA) | ✅ sem violações sérias/críticas em `/` e `/terminal` após corrigir contraste dos índices e nomes acessíveis de dois botões |
| Web vitals (laboratório, Playwright) | desktop: LCP ≈ 0,2–0,3 s · CLS 0,005 · INP ≈ 72–120 ms; móvel (Pixel 7, CPU 4×, 1,6 Mbps): LCP ≈ 1,2 s · CLS 0,012 · INP ≈ 72 ms. Medições locais — confirme em produção (PageSpeed/CrUX) |

## Vídeos Higgsfield (13/11/2026)

| Verificação | Resultado |
|---|---|
| Dados enviados à Higgsfield | ✅ apenas prompts artísticos e quadros-chave gerados pela própria Higgsfield; nenhum código, segredo, conteúdo da narrativa, dado de visitante ou captura de projeto |
| Revisão dos arquivos gerados | ✅ quadros inspecionados: sem texto, logos, pessoas, escudos ou marcas d'água |
| Origem da mídia | ✅ servida de `/media` no próprio domínio (e2e confirma); CSP inalterada (`media-src 'self'`) |
| Movimento reduzido | ✅ nenhum vídeo é baixado (e2e) — só posters estáticos |
| Fora da tela | ✅ vídeos pausam (e2e) |
| Peso | 4,8 MB em `public/media` no total (WebM + MP4 + posters); o navegador baixa só um formato por vídeo e só quando visível |
| Web vitals com vídeos (laboratório, Chromium headless sem GPU) | desktop: LCP 0,25–0,55 s · CLS 0,005 · INP 136–192 ms; móvel (Pixel 7, CPU 4×, 1,6 Mbps): LCP 1,2–1,6 s · CLS 0,012 · INP 80–104 ms. O INP é dominado pela pintura em software; o processamento dos eventos fica em 0–4 ms |
| Ajustes feitos | desfoque CSS sobre vídeo em reprodução trocado por desfoque no encode; navegação com desfoque mais leve |

## Problemas encontrados e corrigidos durante o desenvolvimento

| Problema | Correção |
|---|---|
| `drizzle-kit` trazia `esbuild` com aviso moderado (GHSA-67mh-4wv8-2f99) | removido; migrações SQL próprias |
| Sem proxy confiável, todos os IPs cairiam num bucket único (um visitante poderia bloquear todos) | sem IP confiável, limites por IP são desligados e `TRUST_PROXY=true` passa a ser obrigatório em produção |
| Testes públicos continham exemplos iguais a respostas reais | exemplos neutros; testes com soluções movidos para `narrative/` (privado) |
| Textos públicos (404, comentário HTML) mencionavam uma palavra-resposta | textos reescritos; auditoria passou a cobrir isso |
| Terminal em tela cheia ficava abaixo da navegação (contexto de empilhamento criado por `isolate`) | removido o contexto de empilhamento do hero |
