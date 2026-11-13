# Modelo de ameaças

Referências: OWASP ASVS 5.0 (V1 arquitetura, V2 validação, V3 web frontend, V4 API, V6 autenticação/
sessão anônima, V8 autorização, V11 criptografia, V13 configuração, V14 dados, V16 logs) e OWASP Top 10.

## Ativos

| Ativo | Sensibilidade |
|---|---|
| Soluções dos enigmas e conteúdo de capítulos futuros | alta (integridade do jogo) |
| Regras de desbloqueio e condições dos finais/eggs | alta |
| Progresso de cada sessão | média (integridade, isolamento) |
| `PUZZLE_HMAC_KEY`, `IP_HASH_KEY`, `DATABASE_URL` | crítica |
| Conteúdo público do portfólio | pública |

## Atacante considerado

Visitante sem credenciais que pode: abrir o Inspecionar; ler HTML, CSS, bundles e o Network; repetir
e alterar requisições; editar cookies e `localStorage`; automatizar tentativas; tentar caminhos e
recursos futuros diretamente; procurar arquivos publicados.

**Fora do escopo**: quem tem acesso autorizado ao código privado (`narrative/`), ao banco ou à
infraestrutura. Isso é controlado operacionalmente (acesso mínimo, segredos no provedor, backups privados).

## Ameaças e controles

| Ameaça | Controle | Onde |
|---|---|---|
| Ler respostas/conteúdo futuro no bundle, HTML, RSC, sourcemaps | conteúdo narrativo só no banco; módulos `server-only`; `productionBrowserSourceMaps: false`; `outputFileTracingExcludes` para `narrative/`; auditoria automática do build | `scripts/audit-bundle.ts`, `narrative/story.spec.ts` |
| Ler pistas visuais futuras (variantes da interface) | conteúdo dos slots só no banco; `/api/ui` devolve apenas slots cujas condições a sessão satisfaz; nunca cria sessão | `app/api/ui`, `engine.ts#runUi` |
| Chamar a API para pular capítulos | pré-requisitos (flags) avaliados no servidor; comandos bloqueados = inexistentes; arquivos futuros não existem para a sessão | `terminal/engine.ts`, `vfs.ts` |
| Forjar progresso (cookie, corpo, parâmetros) | progresso nunca vem do cliente; schema Zod `.strict()`; token opaco de 256 bits, hash no banco; cookie inválido ⇒ sessão nova | `sessions/session.ts`, `app/api/*` |
| Força bruta de respostas | limite de falhas por desafio/janela; limite de falhas por IP entre sessões; limite de criação de sessões por IP; limites gerais por IP e por sessão | `security/rate-limit.ts`, `engine.ts` |
| Condição de corrida (requisições concorrentes) | transação + `SELECT … FOR UPDATE`; PK composta + `ON CONFLICT DO NOTHING` | `engine.ts` |
| SQL Injection | Drizzle com parâmetros; SQL bruto apenas com template `sql\`\`` parametrizado | todo `src/server` |
| XSS pelo terminal | saída como texto (React escapa); nenhum `dangerouslySetInnerHTML` com dados; links só para destinos públicos configurados e `https:`; CSP com nonce | `Terminal.tsx`, `proxy.ts` |
| Execução de comandos reais / path traversal | interpretador próprio sem shell/eval; VFS em memória; caminhos canonizados, `..` limitado à raiz, lista de caracteres permitidos | `parser.ts`, `vfs.ts` |
| CSRF | `Origin` obrigatório e igual ao site; `Sec-Fetch-Site`; cabeçalho customizado; apenas JSON; `SameSite=Lax` | `security/request.ts` |
| Clickjacking, sniffing, vazamento de referer | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS | `next.config.ts`, `proxy.ts` |
| Erros que revelam detalhes | respostas genéricas; logs só com o tipo do erro; validação sem detalhes | `http/handler.ts` |
| Configuração insegura em produção | app falha ao iniciar sem PG, chaves fortes, HTTPS e proxy confiável | `env.ts` |
| Repositório público expondo a história | `narrative/` no `.gitignore`; testes com soluções ficam em `narrative/`; testes públicos sem respostas | `.gitignore` |
| DoS de recursos | corpo ≤ 2 KB; entrada ≤ 200 caracteres; ≤ 12 argumentos; saída ≤ 400 linhas; `statement_timeout`; limpeza periódica | vários |
| Privacidade | sem câmera/microfone/localização/arquivos; IP anonimizado (HMAC); sessões expiram em 30 dias; nenhum dado pessoal pedido | — |

## Riscos residuais aceitos

- Conteúdo já liberado para uma sessão pode ser compartilhado por quem o desbloqueou (inerente).
- Enigmas de múltipla escolha têm espaço de busca pequeno; por isso o capítulo 6 é de tentativa única
  e o acesso a ele exige resolver os anteriores.
- `style-src-attr 'unsafe-inline'` é permitido para animações (atributos `style` não executam código).
- Sem `TRUST_PROXY`, limites por IP ficam desativados (só por sessão); por isso é obrigatório em produção.
