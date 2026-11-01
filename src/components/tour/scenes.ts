// Cenas do Modo Roteiro (§10). Cada cena cobre um tópico exigido no pitch e um
// trecho da execução real do exemplo 1 (entrada 5 no teclado).
//
// A fala de cada cena é idêntica à de docs/roteiro-video.md (verificado em teste).

export type TourScene = {
  readonly id: number;
  readonly title: string;
  readonly seconds: number; // duração-alvo
  /** Frames do exemplo 1 exibidos na cena (inclusive): 0 = antes do boot; n = depois da n-ésima microetapa. */
  readonly frames: readonly [number, number];
  readonly narration: string; // fala do autor, exibida como legenda
};

/** Duração máxima do tour: 3min40s, deixando margem nos 4 minutos do vídeo (§10). */
export const MAX_TOUR_SECONDS = 220;

export const TOUR_KEYBOARD_INPUT = 5;

export const SCENES: readonly TourScene[] = [
  {
    id: 1,
    title: "Objetivo do simulador e problema da NeoCore",
    seconds: 20,
    frames: [0, 0],
    narration:
      "A NeoCore Tech forma estudantes que aprendem registradores, ULA, cache e barramentos em capítulos separados e não enxergam como tudo trabalha junto. O NeoCore Computer Lab resolve isso: um simulador web que mostra, passo a passo, como a CPU busca, decodifica e executa cada instrução.",
  },
  {
    id: 2,
    title: "Arquitetura escolhida: Von Neumann com traços RISC",
    seconds: 30,
    frames: [1, 1],
    narration:
      "A arquitetura é Von Neumann: uma única memória guarda programa e dados, e tudo passa pelos mesmos barramentos. No boot, o loader copia o programa do disco para a RAM: instruções a partir de 0x00 e o dado 7 em 0x20, na mesma memória. Do RISC vieram três traços: só LOAD e STORE acessam a memória, toda instrução tem 16 bits e são apenas 14 instruções.",
  },
  {
    id: 3,
    title: "Componentes da CPU: UC, ULA e registradores",
    seconds: 30,
    frames: [2, 11],
    narration:
      "Dentro da CPU, a Unidade de Controle comanda cada passo. O PC aponta a próxima instrução, o MAR leva o endereço à memória, o MDR recebe a palavra e o IR guarda a instrução para a UC decodificar. Nesta primeira instrução, LOAD R0, a CPU lê o valor digitado no teclado e o grava no registrador R0. A ULA, que faz as contas, entra em ação daqui a pouco.",
  },
  {
    id: 4,
    title: "Memória, cache e barramentos",
    seconds: 35,
    frames: [12, 20],
    narration:
      "Agora a CPU lê a constante em 0x20. Repare nos três barramentos: o de endereços, em azul, leva o endereço; o de dados, em verde, traz a palavra; o de controle, em laranja, leva o sinal MEM_READ. Antes da RAM, a CPU consulta a cache. Aqui é um MISS: o dado não está lá, e a CPU espera quatro ciclos pela RAM, que é mais lenta. A cache guarda uma cópia para os próximos acessos.",
  },
  {
    id: 5,
    title: "Ciclo de busca, decodificação e execução ao vivo",
    seconds: 60,
    frames: [21, 28],
    narration:
      "Vamos acompanhar uma instrução inteira: ADD R0, R1. Busca: o PC vai para o MAR, a memória entrega a palavra pelo barramento de dados, ela entra no MDR e depois no IR, e o PC avança. Decodificação: a UC separa os campos do IR, opcode, rd e rs, e descobre que é uma soma entre R0 e R1. Execução: a UC envia R0 e R1 para a ULA, que calcula cinco mais sete, igual a doze, atualiza as flags e devolve o resultado para R0. Em cada etapa, o painel ao lado explica o que aconteceu e qual sinal de controle foi usado.",
  },
  {
    id: 6,
    title: "Fluxo da instrução até a E/S",
    seconds: 25,
    frames: [29, 36],
    narration:
      "Em seguida, STORE R0 envia o resultado ao display. O endereço 0xF1 pertence à região de E/S: a cache e a RAM ficam de fora, e o valor doze viaja pelo barramento de dados até o display, que passa a mostrá-lo. É a E/S mapeada em memória.",
  },
  {
    id: 7,
    title: "Como o simulador ajuda o estudante",
    seconds: 20,
    frames: [37, 42],
    narration:
      "Com HLT, a execução termina. O estudante pode voltar, avançar, mudar a entrada ou escrever o próprio programa e ver cada componente agir, em vez de decorar peças isoladas. É assim que o NeoCore Computer Lab torna visível o que acontece dentro do computador.",
  },
];
