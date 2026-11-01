# Roteiro do vídeo pitch

Vídeo de até **4 minutos**, publicado no YouTube como **não listado** (R14). Ele é gravado navegando pelo **Modo Roteiro** (`/tour`) do simulador, que executa o exemplo 1 (*Soma simples*, entrada 5 no teclado) e mostra cada cena com a legenda abaixo. O tour dura **3min40s**, o que deixa 20 segundos de margem.

> As falas e as durações deste roteiro são as mesmas do tour (`src/components/tour/scenes.ts`). Um teste automatizado falha se os dois divergirem; ao mudar um, mude o outro.

## Visão geral

| Cena | Tempo | Duração | Tópico do enunciado | Itens da matriz |
|---|---|---|---|---|
| 1 | 00:00–00:20 | 20 s | Objetivo do simulador e problema da NeoCore | R1 |
| 2 | 00:20–00:50 | 30 s | Arquitetura escolhida (Von Neumann + RISC) | R2, R3 |
| 3 | 00:50–01:20 | 30 s | Componentes da CPU (UC, ULA, registradores) | R4 |
| 4 | 01:20–01:55 | 35 s | Memória, cache e barramentos | R5, R6 |
| 5 | 01:55–02:55 | 60 s | Ciclo fetch–decode–execute ao vivo | R8, R9, R10, R11 |
| 6 | 02:55–03:20 | 25 s | Fluxo da instrução até a E/S (display) | R7, R8 |
| 7 | 03:20–03:40 | 20 s | Como isso ajuda o estudante | R12 |

## Como gravar

1. Abra o app em uma janela anônima, em tela cheia (1920 × 1080), e vá em **Tour**.
2. Inicie a gravação de tela e clique em **▶ Iniciar** (ou tecle Espaço). O tour avança sozinho, no ritmo das falas.
3. Leia a fala de cada cena enquanto ela aparece na legenda. Se precisar, pause com Espaço e retome; ← e → trocam de cena.
4. Ao fim (03:40), pare a gravação. Publique no YouTube como **não listado** e coloque o link no README e no Apêndice B do relatório.

## Cenas

## Cena 1 — Objetivo do simulador e problema da NeoCore (20 s)

- **Tempo:** 00:00–00:20
- **Na tela:** o simulador antes do boot: CPU, cache, RAM, disco e E/S apagados, com o programa ainda no disco.
- **Fala:** "A NeoCore Tech forma estudantes que aprendem registradores, ULA, cache e barramentos em capítulos separados e não enxergam como tudo trabalha junto. O NeoCore Computer Lab resolve isso: um simulador web que mostra, passo a passo, como a CPU busca, decodifica e executa cada instrução."

## Cena 2 — Arquitetura escolhida: Von Neumann com traços RISC (30 s)

- **Tempo:** 00:20–00:50
- **Na tela:** o BOOT: o disco e a RAM acesos, o programa indo pelo barramento de dados e o sinal RESET no barramento de controle. No quadro "Memória (RAM)", ao lado do diagrama, aparecem as instruções a partir de 0x00 e o dado 7 em 0x20, na mesma memória.
- **Fala:** "A arquitetura é Von Neumann: uma única memória guarda programa e dados, e tudo passa pelos mesmos barramentos. No boot, o loader copia o programa do disco para a RAM: instruções a partir de 0x00 e o dado 7 em 0x20, na mesma memória. Do RISC vieram três traços: só LOAD e STORE acessam a memória, toda instrução tem 16 bits e são apenas 14 instruções."

## Cena 3 — Componentes da CPU: UC, ULA e registradores (30 s)

- **Tempo:** 00:50–01:20
- **Na tela:** a instrução `LOAD R0, [0xF0]`: PC → MAR, MDR, IR e a Unidade de Controle acendendo na busca e na decodificação; em seguida o teclado responde e o valor 5 entra em R0.
- **Fala:** "Dentro da CPU, a Unidade de Controle comanda cada passo. O PC aponta a próxima instrução, o MAR leva o endereço à memória, o MDR recebe a palavra e o IR guarda a instrução para a UC decodificar. Nesta primeira instrução, LOAD R0, a CPU lê o valor digitado no teclado e o grava no registrador R0. A ULA, que faz as contas, entra em ação daqui a pouco."

## Cena 4 — Memória, cache e barramentos (35 s)

- **Tempo:** 01:20–01:55
- **Na tela:** a instrução `LOAD R1, [0x20]`: os três barramentos em uso (endereço 0x20, a palavra 7, MEM_READ), a cache registrando MISS e a RAM com 4 ciclos de espera; a cópia é gravada na linha 0 da cache.
- **Fala:** "Agora a CPU lê a constante em 0x20. Repare nos três barramentos: o de endereços, em azul, leva o endereço; o de dados, em verde, traz a palavra; o de controle, em laranja, leva o sinal MEM_READ. Antes da RAM, a CPU consulta a cache. Aqui é um MISS: o dado não está lá, e a CPU espera quatro ciclos pela RAM, que é mais lenta. A cache guarda uma cópia para os próximos acessos."

## Cena 5 — Ciclo de busca, decodificação e execução ao vivo (60 s)

- **Tempo:** 01:55–02:55
- **Na tela:** a instrução `ADD R0, R1` do início ao fim: as 4 microetapas da busca, a decodificação (campos do IR) e a execução (R0 e R1 na ULA, 5 + 7 = 12, flags, escrita em R0). O indicador de fase e o painel de explicação acompanham cada microetapa.
- **Fala:** "Vamos acompanhar uma instrução inteira: ADD R0, R1. Busca: o PC vai para o MAR, a memória entrega a palavra pelo barramento de dados, ela entra no MDR e depois no IR, e o PC avança. Decodificação: a UC separa os campos do IR, opcode, rd e rs, e descobre que é uma soma entre R0 e R1. Execução: a UC envia R0 e R1 para a ULA, que calcula cinco mais sete, igual a doze, atualiza as flags e devolve o resultado para R0. Em cada etapa, o painel ao lado explica o que aconteceu e qual sinal de controle foi usado."

## Cena 6 — Fluxo da instrução até a E/S (25 s)

- **Tempo:** 02:55–03:20
- **Na tela:** a instrução `STORE R0, [0xF1]`: o acesso de E/S faz bypass da cache, o valor 12 vai pelo barramento de dados com MEM_WRITE e o display passa a mostrar 12.
- **Fala:** "Em seguida, STORE R0 envia o resultado ao display. O endereço 0xF1 pertence à região de E/S: a cache e a RAM ficam de fora, e o valor doze viaja pelo barramento de dados até o display, que passa a mostrá-lo. É a E/S mapeada em memória."

## Cena 7 — Como o simulador ajuda o estudante (20 s)

- **Tempo:** 03:20–03:40
- **Na tela:** a busca e a execução de `HLT`: a máquina para, com o display mostrando 12.
- **Fala:** "Com HLT, a execução termina. O estudante pode voltar, avançar, mudar a entrada ou escrever o próprio programa e ver cada componente agir, em vez de decorar peças isoladas. É assim que o NeoCore Computer Lab torna visível o que acontece dentro do computador."
