/**
 * Comandos PÚBLICOS do terminal. Este arquivo vai para o navegador e alimenta
 * o `help`, o autocompletar e o modo offline. Comandos narrativos ou ocultos
 * nunca aparecem aqui: eles existem apenas no banco de dados do servidor.
 */

export interface PublicCommand {
  name: string;
  usage: string;
  summary: string;
}

export const PUBLIC_COMMANDS: PublicCommand[] = [
  { name: "help", usage: "help", summary: "lista os comandos" },
  { name: "about", usage: "about", summary: "apresenta a Tryggport Dev" },
  { name: "projects", usage: "projects", summary: "lista os projetos" },
  { name: "project", usage: "project <nome>", summary: "detalhes de um projeto" },
  { name: "skills", usage: "skills", summary: "tecnologias usadas" },
  { name: "contact", usage: "contact", summary: "formas de contato" },
  { name: "ls", usage: "ls [-a] [dir]", summary: "lista um diretório virtual" },
  { name: "cd", usage: "cd <dir>", summary: "muda de diretório" },
  { name: "cat", usage: "cat <arquivo>", summary: "lê um arquivo virtual" },
  { name: "pwd", usage: "pwd", summary: "mostra o diretório atual" },
  { name: "clear", usage: "clear", summary: "limpa a tela" },
  { name: "history", usage: "history", summary: "comandos recentes" },
  { name: "status", usage: "status", summary: "estado do sistema" },
  { name: "whoami", usage: "whoami", summary: "identifica a sessão" },
  { name: "date", usage: "date", summary: "data do sistema" },
  { name: "ping", usage: "ping <destino>", summary: "testa comunicação (simulada)" },
  { name: "scan", usage: "scan <alvo>", summary: "examina o sistema" },
  { name: "echo", usage: "echo <texto>", summary: "repete o texto" },
  { name: "man", usage: "man <comando>", summary: "manual de um comando" },
  { name: "hint", usage: "hint [número]", summary: "dicas graduais para investigações" },
  { name: "visual", usage: "visual", summary: "volta ao modo visual" },
];

export const PUBLIC_MANUAL: Record<string, string[]> = {
  help: ["HELP(1)", "Lista os comandos disponíveis nesta sessão."],
  about: ["ABOUT(1)", "Apresenta a Tryggport Dev."],
  projects: ["PROJECTS(1)", "Lista os projetos publicados no portfólio."],
  project: ["PROJECT(1)", "uso: project <nome>", "Mostra descrição, tecnologias e endereço de um projeto.", "exemplos: project fendalume · project fc26"],
  skills: ["SKILLS(1)", "Tecnologias efetivamente usadas na construção deste site."],
  contact: ["CONTACT(1)", "Canais de contato profissionais."],
  ls: ["LS(1)", "uso: ls [-a] [-l] [diretório]", "  -a  inclui entradas que começam com ponto", "  -l  formato longo"],
  cd: ["CD(1)", "uso: cd <diretório>", "  ~ é o diretório pessoal; .. sobe um nível."],
  cat: ["CAT(1)", "uso: cat <arquivo>", "Exibe o conteúdo de um arquivo virtual."],
  pwd: ["PWD(1)", "Mostra o caminho virtual atual."],
  clear: ["CLEAR(1)", "Limpa a tela. Atalho: Ctrl+L."],
  history: ["HISTORY(1)", "Mostra os comandos recentes desta sessão."],
  status: ["STATUS(1)", "Resumo do estado do sistema."],
  whoami: ["WHOAMI(1)", "Identifica a sessão atual."],
  date: ["DATE(1)", "Data e hora do sistema."],
  ping: ["PING(1)", "uso: ping <destino>", "Simula comunicação com destinos do ambiente.", "Nenhum pacote real é enviado."],
  scan: ["SCAN(1)", "uso: scan <alvo>", "alvos: system · memory · network"],
  echo: ["ECHO(1)", "uso: echo <texto>", "Repete o texto informado."],
  man: ["MAN(1)", "uso: man <comando>", "Mostra o manual de um comando."],
  hint: [
    "HINT(1)",
    "uso: hint [número]",
    "Lista as investigações em andamento e libera dicas em três níveis:",
    "onde observar → qual mecanismo → explicação parcial. Nunca a resposta.",
    "Cada nível seguinte libera após um tempo ou após algumas tentativas.",
  ],
  visual: ["VISUAL(1)", "Fecha o terminal e volta ao modo visual. Atalho: Esc."],
};
