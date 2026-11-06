# Decisões de arquitetura

Registro das justificativas e simplificações do NeoCore Computer Lab. Este documento alimenta o [relatório técnico](relatorio/relatorio.md). A especificação de referência é a §4 do `CLAUDE.md` ("NeoCore-8"); cada decisão abaixo indica a fase em que foi tomada.

## Índice

| Tema | Decisões | Seção do relatório |
|---|---|---|
| Arquitetura e ISA | seção 1, D5, D8, D25 | 1, 2, 8 |
| CPU (UC, ULA, registradores) | D3, D4, D6, D9 | 4, 8 |
| Ciclos e microetapas | D10, D11, D13 | 7, 8 |
| Memória, cache e E/S | D7, D12, D14 | 5, 6.1 |
| Interface (diagrama, painéis, controles) | D15, D16, D18, D19, D20 | 3, 6, 9 |
| Tour, página Sobre e documentação | D22, D23, D24, D26 | 9, apêndices |
| Infraestrutura e testes | D1, D2, D17, D21 | Apêndice A |
| Simplificações declaradas | seção 3 | 9 |

## 1. Arquitetura simulada

Resumo da especificação (`CLAUDE.md` §4), detalhada nas decisões da seção 2:

- **Von Neumann:** memória única para instruções e dados, com um único conjunto de barramentos. Isso evidencia o gargalo de Von Neumann na contagem de ciclos.
- **Traços RISC:** modelo load/store, instrução de formato fixo (16 bits) e ISA com 14 instruções.
- **Sem pipeline:** execução estritamente sequencial, para que cada fase do ciclo seja observável isoladamente.
- **E/S mapeada em memória:** endereços `0xF0` a `0xF2`, que não passam pela cache.
- **Cache L1:** mapeamento direto, 8 linhas, write-through e no-write-allocate.

## 2. Decisões de implementação

### D1 — Stack e versões (Fase 0)
- O projeto usa Next.js **16.4.3** (App Router), React 19, TypeScript em modo `strict`, Tailwind CSS 4 e ESLint 9 (flat config), conforme a §3.
- Os testes usam Vitest 5 com cobertura `@vitest/coverage-v8` e Playwright (Chromium).
- `@types/node` foi atualizado de `^20` para `^24`. O Vitest 5 exige `@types/node` ≥ 22, e o Node usado no desenvolvimento é o v24. Nenhuma dependência nova foi adicionada.
- Versão mínima do Node: **22.12**, exigida pelo Vitest 5. O Next 16 aceita a partir da 20.9.

### D2 — Build estático sem Cache Components (Fase 0)
- `next.config.ts` usa `output: "export"`, que gera o site estático em `out/` para a Vercel.
- O `create-next-app` habilita `cacheComponents` e `partialPrefetching` por padrão. Esses recursos usam Partial Prerendering (PPR), que o Next **não permite** com `output: "export"` (o build falha com `PPR cannot be enabled in export mode`). Como o simulador roda 100% no navegador e não tem servidor nem dados dinâmicos, as duas opções foram removidas sem perda funcional.

### D3 — Granularidade de `ComponentId` (Fase 0)
- Os registradores `R0`–`R3`, `PC`, `IR`, `MAR`, `MDR` e `FLAGS` são componentes destacáveis **individualmente**, em vez de um único "banco de registradores". Assim, a microetapa `ADD R0, R1` acende exatamente os dois registradores envolvidos, e o aluno vê quais operandos a ULA recebe.
- Os dispositivos de E/S também são individuais (`KEYBOARD`, `DISPLAY`, `LED`), porque cada um ocupa um endereço próprio.
- Os barramentos não são `ComponentId`. Eles são descritos pelo campo `buses` de cada `MicroStep` (endereço, dado e sinais de controle), conforme a §5.2.

### D4 — `MachineState` (Fase 0, revisado na Fase 2)
- `src/core/types.ts` declara um `MachineState` imutável (`readonly`) derivado dos parâmetros da §4.2 e §4.5: registradores, especiais, flags, memória de 256 palavras, cache de 8 linhas com contadores, E/S, disco, ciclo, fase e erro didático.
- *Fase 2:* o estado recebeu `aluOutput` e `microIndex` (D9), e `phase` passou a indicar a fase da **próxima** microetapa (ou `HALT`).

### D5 — Codificação e decodificação (Fase 1, `isa.ts`)
- Os campos que uma instrução não usa (ex.: `rs` em `LDI`, `rd`/`rs` em `JMP`) são gravados como `0` pelo montador. Na decodificação, porém, eles são **lidos e mantidos**: a UC extrai os quatro campos de qualquer palavra, como o hardware faz, e simplesmente ignora os que não interessam. Isso garante `encode(decode(w)) === w` para toda palavra com opcode válido, o que é verificado exaustivamente nas 65.536 palavras.
- Os opcodes reservados `0xD` e `0xE` **não lançam exceção**: `decode` retorna `valid: false` com a mensagem "Instrução inválida: o opcode 0xD é reservado.", que a UI exibirá como exceção didática (§4.4).

### D6 — Flags da ULA (Fase 1, `alu.ts`)
- **Z** = resultado igual a zero; **N** = bit 15 do resultado (sinal em complemento de dois).
- **C em ADD** = vai-um para fora do bit 15 (soma sem sinal > `0xFFFF`).
- **C em SUB** = **empresta-um (borrow)**, ligado quando `rd < rs` sem sinal. Foi escolhida a convenção de "borrow" (a mesma do x86) porque é a mais intuitiva para o aluno ("faltou para subtrair"). A convenção inversa, usada no ARM, foi descartada para evitar confusão.
- **V** = overflow com sinal. Em ADD, liga quando os operandos têm o mesmo sinal e o resultado tem sinal oposto. Em SUB, liga quando os operandos têm sinais opostos e o resultado tem o sinal de `rs`.
- **AND, OR e NOT atualizam só Z e N** (tabela da §4.4); C e V **mantêm** o valor anterior.
- A ULA só executa as cinco operações que afetam flags (ADD, SUB, AND, OR, NOT). `MOV` e `LDI` não passam pela ULA e não alteram flags; elas são transferências entre registradores, implementadas pela UC na Fase 2.

### D7 — Memória e região de E/S (Fase 1, `memory.ts`)
- A memória é um vetor imutável de 256 palavras: `writeWord` devolve uma cópia nova, o que permite o "voltar" da §5.1.
- O programa carregado ocupa no máximo `0x00`–`0xEF` (240 palavras). Os endereços `0xF0`–`0xFF` são reservados à E/S; `createMemory` rejeita imagens que os invadam.
- Neste nível, `readWord`/`writeWord` acessam os 256 endereços sem distinção. O desvio dos acessos a `0xF0`–`0xFF` para os dispositivos (`io.ts`) e o bypass da cache são responsabilidade da máquina (Fase 2) e da cache (Fase 3).

### D8 — Regras do montador (Fase 1, `assembler.ts`)
- **Duas passagens:** a 1ª calcula endereços e registra rótulos (permitindo saltos para frente); a 2ª resolve operandos e gera o código. Todos os erros são coletados e ordenados por linha; com qualquer erro, nenhum programa é gerado.
- **Maiúsculas/minúsculas:** mnemônicos, registradores e diretivas não diferenciam (`add r0, r1` é aceito). **Rótulos diferenciam** (`Loop` ≠ `loop`), como na maioria dos montadores.
- **Operandos:** `LOAD`/`STORE` exigem o endereço entre colchetes (`[0x20]`), reforçando visualmente que há acesso à memória. `JMP`/`JZ`/`JN` usam o endereço sem colchetes. Onde se espera um valor de 8 bits, um rótulo vale o seu endereço.
- **`LDI`** aceita imediato de 0 a 255, estendido com zeros para 16 bits. Valores negativos são rejeitados porque, com extensão por zeros, `LDI R0, -1` carregaria 255, o que seria enganoso. Para constantes negativas, usa-se `.word` com `LOAD`.
- **`.word`** aceita um valor de 16 bits sem sinal (0–65535), com sinal (−32768 a −1, gravado em complemento de dois) ou um rótulo.
- **`.org`** aceita apenas número literal (o endereço precisa ser conhecido na 1ª passagem), dentro de `0x00`–`0xEF`. Pode voltar para trás, desde que não sobreponha endereços já ocupados (sobreposição é erro).
- **Lacunas** deixadas por `.org` são preenchidas com `0x0000`, que é a instrução `NOP`.
- A **listagem** associa cada linha do fonte ao endereço e ao código de máquina gerado; a UI (Fase 5) usará `extractFields` para colorir os campos.

### D9 — UC como sequenciador de microetapas (Fase 2, `controlUnit.ts`)
- O estado guarda `phase` e `microIndex`, que funcionam como o "contador de microetapa" da UC: indicam qual é a **próxima** microetapa. Cada fase tem um plano (uma lista de micro-operações) e, ao terminá-lo, a UC passa para a fase seguinte: `BOOT → FETCH → DECODE → EXECUTE → FETCH → …`. É uma versão simplificada de uma UC microprogramada.
- O plano de **FETCH** tem 4 microetapas e é **idêntico para toda instrução** (verificado em teste com as 14 instruções), porque a UC ainda não sabe qual instrução está buscando.
- O plano de **EXECUTE** é escolhido a partir do IR: depende da instrução, do endereço (RAM ou E/S) e, em `JZ`/`JN`, da flag testada. Ele é sempre calculado a partir de dados que não mudam durante a própria instrução, por isso é estável microetapa a microetapa.
- Quantidade de microetapas de execução: `NOP`, `LDI`, `MOV`, `JMP` e `HLT` têm 1; as operações da ULA têm 3 (entradas → cálculo e flags → escrita em rd); `LOAD` tem 4 (RAM) ou 5 (E/S); `STORE` tem 2 (RAM) ou 3 (E/S); `JZ`/`JN` têm 1 (desvio não tomado) ou 2 (desvio tomado).
- `NOP` ganhou uma microetapa explícita, para que o aluno veja que ela também passa pela execução.
- A saída da ULA fica guardada em `aluOutput` entre o cálculo (que atualiza as flags) e a escrita em `rd`, como o registrador de saída da ULA em uma CPU real.

### D10 — Ciclos de clock (Fase 2, `machine.ts`; revisado na Fase 3)
- Cada microetapa da CPU dura **1 ciclo**. Os acessos à RAM (leitura na busca, leitura em `LOAD`, escrita em `STORE`) somam **4 ciclos de espera** (wait states, §4.5), visíveis no campo `waitCycles`.
- O **BOOT não consome ciclos**: o carregamento do disco acontece antes de a CPU começar a executar (§4.5: "apenas no carregamento"). Avançar uma máquina parada também não consome ciclos.
- Sem cache, uma busca custa 8 ciclos (1 + 5 + 1 + 1), e o exemplo 1 termina em **65 ciclos**.
- *Fase 3:* com a cache, uma leitura custa **1 ciclo em HIT** e **5 em MISS** (1 + 4 de espera); a escrita custa sempre 5 (write-through). O exemplo 1 continua com 65 ciclos (nenhum endereço se repete); o exemplo 2 cai de 350 para 258.

### D11 — Barramentos e sinais de controle nas microetapas (Fase 2)
- `buses.address` e `buses.data` representam apenas o **barramento do sistema** (CPU ↔ memória/E/S). As transferências internas da CPU (ex.: `R0 → MDR`, `MDR → IR`, entrada da ULA) não preenchem esses campos.
- `CLOCK` aparece em toda microetapa executada pela CPU, porque cada uma ocorre em um pulso de clock. `RESET` aparece no BOOT, e `HALT` em `HLT` e nas exceções.
- `ALU_OP` indica que a UC selecionou uma operação da ULA; qual operação foi selecionada aparece na explicação (ex.: "ALU_OP = ADD").
- O campo `changes` é calculado pela máquina **comparando o estado antes e depois** da microetapa (registradores, flags, memória, display e LED). Assim, a lista de alterações nunca diverge do que de fato mudou. As flags aparecem como `FLAGS.Z`, `FLAGS.N` etc., com valores 0/1.

### D12 — E/S mapeada em memória (Fase 2, `io.ts`)
- Todo acesso a `0xF0`–`0xFF` é desviado para os dispositivos. As posições correspondentes do vetor da RAM nunca são lidas nem escritas.
- Conforme a §4.6, o acesso à E/S tem uma **microetapa extra**, em que o dispositivo responde no barramento: em `LOAD`, o dispositivo coloca o valor no barramento de dados antes de o MDR armazená-lo; em `STORE`, o dispositivo captura o valor do barramento.
- **Teclado** (`0xF0`) é só entrada: a escrita é ignorada (e explicada). **Display** (`0xF1`) e **LED** (`0xF2`) são saídas, mas a leitura devolve o valor exibido. **Endereços sem dispositivo** (`0xF3`–`0xFF`) leem 0 e ignoram a escrita.
- A entrada do teclado pode ser alterada a qualquer momento (`setKeyboardInput`) e é mantida em `reset` e `load`, já que pertence ao usuário e não ao programa.

### D13 — Exceções didáticas (Fase 2)
- **Opcode reservado** (`0xD`, `0xE`): detectado na DECODIFICAÇÃO. A microetapa "Exceção: instrução inválida" ativa `HALT`, e a máquina para com `error` preenchido.
- **PC na região de E/S**: se o PC chegar a `0xF0`–`0xFF` (por um `JMP` ou por um programa sem `HLT`), a BUSCA gera "Exceção: busca fora da área de programa" e a máquina para. Isso mantém a busca idêntica para toda instrução válida e reforça que ali não há memória de programa.
- Nenhum dos casos lança exceção JavaScript: o simulador continua funcionando e explica o que aconteceu.
- `run()` executa no máximo 10.000 microetapas por padrão, para que um laço infinito (ex.: `loop: JMP loop`) não trave a interface.

### D14 — Cache L1 (Fase 3, `cache.ts`)
- **Mapeamento direto, 8 linhas de 1 palavra.** O endereço de 8 bits se divide em **tag (5 bits) | índice (3 bits)**: o índice escolhe a linha, e a tag registra qual dos 32 endereços que caem nessa linha ela está guardando. Cada linha tem um bit de validade.
- **Unificada:** instruções e dados disputam as mesmas linhas, coerente com Von Neumann. O material da disciplina (Unidade 1) apresenta a L1 dividida, como nos processadores atuais; a cache unificada é uma simplificação consciente, sustentada por Stallings (8. ed., seção 4.3): ela equilibra a carga entre instruções e dados e tende a ter taxa de acerto maior para o mesmo tamanho. Isso cria conflitos visíveis: no exemplo 1, o dado em `0x20` (índice 0, tag `0x04`) expulsa a instrução de `0x00` (índice 0, tag `0x00`).
- **Leitura** (busca e `LOAD`), em duas microetapas com os mesmos títulos em HIT e MISS:
  1. "MEM_READ: consulta à cache". Em **HIT**, custa 1 ciclo e ativa só a cache. Em **MISS**, custa 1 + 4 ciclos de espera e ativa cache e RAM. A explicação diz por que foi MISS: linha vazia ou tag de outro endereço.
  2. "MDR ← M[MAR]". Em HIT, a palavra vem da cache. Em MISS, vem da RAM, e a cache guarda uma cópia na linha, substituindo o que havia.
- **Escrita** (`STORE` na RAM): **write-through** (a RAM é sempre escrita, sempre com os 4 ciclos de espera) e **no-write-allocate** (a cache só é atualizada se já tiver o endereço; caso contrário, não muda). O evento registrado é `WRITE`.
- **E/S** (`0xF0`–`0xFF`): não é cacheável. O evento `BYPASS` aparece na microetapa de acesso à E/S, e a cache não é consultada nem alterada.
- **Contadores:** `hits` e `misses` contam apenas **leituras** (busca e `LOAD`), porque são elas que a cache pode acelerar. Escritas e bypass não entram na taxa de acerto.
- **Estatísticas** (`cacheStatistics`): taxa de acerto = hits ÷ (hits + misses). Cada HIT evita 4 ciclos de espera, então ciclos economizados = hits × 4, e ciclos sem cache = ciclos totais + economizados. O valor "sem cache" coincide com o que a Fase 2 media antes da cache: 350 ciclos no exemplo 2, que agora roda em 258 (taxa de acerto de 23/34 ≈ 68%).
- **Reset** esvazia a cache: toda execução começa "fria", e os primeiros acessos são sempre MISS.
- **Exemplo 2:** o dado `passo` foi colocado em `0x20` (índice 0), fora das linhas 1–5 usadas pelo laço. Se ele ficasse logo depois do `HLT` (`0x0A`, índice 2), disputaria a linha com a instrução `LOAD` do laço (`0x02`), e as duas dariam MISS em toda volta. O objetivo do exemplo é mostrar o ganho no laço (§6.3), não esse conflito.
- O campo `changes` continua listando apenas registradores, memória e saídas de E/S. O que acontece na cache aparece no campo `cache` da microetapa e em `lastEvent` de cada linha.

### D15 — Diagrama geral (Fase 4, `src/components/diagram/`)
- **Composição:** os três barramentos do sistema correm na horizontal. Acima deles ficam CPU, cache, RAM e disco; abaixo, os dispositivos de E/S. Cada componente se liga a cada barramento por uma derivação vertical, como no diagrama clássico de barramento de Stallings e Tanenbaum.
- **A UI não interpreta nada além da MicroStep:** `highlights.ts` é uma função pura que traduz a microetapa no que acende. Os componentes acesos são exatamente os `activeComponents`; os valores marcados são exatamente os alvos de `changes`.
- **Trecho do barramento em uso:** acende só o trecho entre a CPU e o componente mais distante entre os ativos. Em um HIT, o trecho vai só até a cache; em um MISS, até a RAM, passando pela cache, que guarda a cópia. A seta e o valor que "viaja" indicam o sentido: da CPU para fora em endereços, escritas e sinais de controle, e de fora para a CPU em leituras. No BOOT, o programa vai do disco para a RAM pelo barramento de dados, e RESET é difundido pelo barramento de controle inteiro.
- **Sinais internos × sinais do sistema:** o barramento de controle mostra só os sinais que saem da CPU (`MEM_READ`, `MEM_WRITE`, `RESET`). Os sinais internos (`ALU_OP`, `REG_WRITE`, `PC_INC`, `IR_LOAD`, `PC_LOAD`, `HALT`) aparecem como etiquetas dentro da Unidade de Controle, e `CLOCK` aparece como uma onda quadrada que se destaca a cada pulso. Assim, o aluno não confunde controle interno da CPU com o barramento do sistema.
- **Cor nunca é o único indicador (§6.5):** um componente ativo inverte as cores do bloco (fundo escuro, texto claro), o que funciona mesmo sem perceber cor. Cada barramento tem, além da cor fixa (endereços azul, dados verde, controle laranja), um **padrão de traço** próprio (tracejado longo, contínuo, pontilhado) e um rótulo escrito. Valores alterados ganham uma marca-texto amarela; flags em 1 ficam preenchidas e mostram o bit (`Z=1`).
- **Movimento reduzido:** com `prefers-reduced-motion`, o valor aparece direto na posição final e as transições de cor são desligadas; os destaques continuam.
- **Acessibilidade:** o SVG tem título e descrição (a microetapa atual), e cada componente é um grupo com nome acessível que indica quando está ativo.
- **Exportar PNG:** o SVG é copiado com os estilos calculados embutidos e desenhado em um canvas com o dobro da resolução, para uso no relatório. Como a imagem gerada não tem acesso às fontes da página, ela usa uma fonte reserva sem serifa.
- **Tipografia e tema:** IBM Plex Sans Condensed (rótulos, estilo folha de dados) e JetBrains Mono (valores). Tema claro "papel técnico" e escuro "bancada", seguindo a preferência do sistema; o seletor manual de tema fica para a Fase 5.

### D16 — Prévia da Fase 4 e store (Fase 4)
- `src/store/simulation.ts` (zustand) guarda o estado da máquina, a última microetapa e o **histórico** de estados anteriores, o que permite **voltar** com exatidão, já que os estados do motor são imutáveis.
- A página inicial mostra o diagrama com uma barra **provisória** (Voltar, Próxima microetapa, Reset, Exportar PNG) só para verificar o diagrama. A Fase 5 a substitui pelos controles completos (§6.2) e pelos painéis.
- *Revisão na Fase 5:* a barra provisória foi substituída, e o histórico passou a ser uma lista de frames com cursor (D18).

### D17 — Testes da interface sem dependências novas (Fase 4)
- O critério "cada `ComponentId` e barramento acende conforme `MicroStep`" é verificado no Vitest renderizando o SVG real com `react-dom/server` (já instalado) em **todas** as microetapas dos 3 exemplos. Não foi preciso adicionar jsdom ou Testing Library (§3).
- Os testes de interface rodam em um projeto separado do Vitest, com o React em modo produção, que renderiza cerca de 20 vezes mais rápido (≈3 ms contra ≈60 ms por diagrama). Eles verificam a estrutura do SVG, que não depende dos avisos do modo de desenvolvimento.
- A cobertura mínima de 90% continua medida só em `src/core` (§8).

### D18 — Histórico da simulação: frames e cursor (Fase 5, `store/simulation.ts`)
- A store guarda a execução como uma lista de **frames** (estado da máquina + a microetapa que o produziu) e um **cursor**. *Voltar*, *avançar* e clicar na *linha do tempo* apenas movem o cursor.
- Avançar a partir de um frame anterior **reaproveita** o frame seguinte em vez de recalcular. Isso é correto porque o motor é determinístico: o resultado seria idêntico (testado).
- **Mudar a entrada do teclado descarta os frames seguintes**, porque o "futuro" dependia da entrada antiga. Mudanças de programa (carregar) e Reset recomeçam do boot.
- Reset e carregar mantêm a entrada atual do teclado. Carregar um **exemplo** aplica a entrada sugerida por ele (5 no exemplo 1).
- O histórico tem o mesmo limite de `run()`: 10.000 microetapas. Ao atingi-lo, a execução para com o aviso de possível laço infinito.

### D19 — Controles e velocidade (Fase 5, `components/controls/`)
- Velocidade 1× = 2,5 microetapas por segundo (400 ms cada); as opções vão de 0,25× (1,6 s) a 4× (100 ms). A execução contínua para sozinha no `HLT`, numa exceção ou no limite de microetapas.
- **Atalhos (§6.2):** → microetapa, Shift+→ instrução, ← voltar, Espaço executar/pausar, R reset. Eles ficam desligados enquanto o foco está em campos de texto, seletores e abas, para não atrapalhar a digitação nem a navegação por setas. Cada botão anuncia seu atalho (`aria-keyshortcuts` e dica).
- O campo do **teclado (0xF0)** aceita decimal de −32768 a 65535 (negativos em complemento de dois) ou hexadecimal `0x0000`–`0xFFFF`; um valor inválido é indicado no próprio campo e não é aplicado.
- **Tema:** segue o sistema por padrão; o botão alterna sistema → claro → escuro e guarda a escolha no navegador (aplicada antes da primeira pintura, sem piscar).
- O **indicador de fase** destaca BUSCA, DECODIFICAÇÃO ou EXECUÇÃO conforme a última microetapa executada e mostra "Carga do programa" no boot e "Parada" depois do `HLT` ou de uma exceção.

### D20 — Painéis e editor (Fase 5)
- **Registradores:** hex e decimal sempre visíveis; o binário aparece ao passar o mouse ou focar com o teclado (o IR aparece separado em opcode | rd | rs | imm/addr). O valor com sinal aparece só em R0–R3 e MDR: no PC, no MAR e no IR o número não representa uma quantidade com sinal. Os valores alterados piscam uma vez (sem animação com movimento reduzido, mas a marca continua).
- **Campos da instrução** têm cores próprias (opcode, rd, rs, imm/addr), mas também ficam separados por espaço e rotulados, para não depender só de cor (§6.5).
- **Memória:** grade 16 × 16 com o PC contornado, o endereço acessado preenchido e o valor alterado com marca-texto. A linha `0xF0` mostra os dispositivos de E/S, deixando claro que ali não há RAM.
- **Linha do tempo:** mostra até 150 microetapas antes e depois da atual (o histórico pode chegar a 10.000) e rola só a própria lista.
- **Estatísticas:** ciclos, instruções, microetapas, CPI, HIT, MISS, taxa de acerto, ciclos economizados e ciclos sem cache.
- **Editor:** ao lado de cada linha aparece o endereço, o código em hex e em binário com campos, ou o erro daquela linha. A lista completa de erros fica abaixo. "Montar e carregar" fica desabilitado enquanto houver erro (§6.4).
- **Arquivo `.neocore.json` (R13):** guarda nome, código assembly e entrada do teclado (`{"format": "neocore-lab/programa", "version": 1, ...}`). A importação valida o arquivo e coloca o código no editor; o usuário confere e então carrega.
- **Layout (§6.1):** em telas a partir de 1280 px, o editor (recolhível) fica à esquerda, o diagrama e as abas no centro e os painéis à direita. Em telas menores, tudo vira uma coluna, sem rolagem horizontal da página (o diagrama rola dentro do próprio quadro).

### D21 — Organização dos testes (Fase 5)
- **Vitest, projeto `core`:** o motor, com cobertura mínima de 90% (§8).
- **Vitest, projeto `components`:** a store (critério de aceite da fase: voltar/avançar consistentes e programa próprio), os painéis e o diagrama renderizados com `react-dom/server`, a formatação e o arquivo `.neocore.json`.
- **Playwright:** o único fluxo E2E da §8 (`tests/e2e/simulador.spec.ts`), em uma porta dedicada (3100) para nunca reaproveitar por engano outro servidor aberto na porta 3000.

### D22 — Modo Roteiro, o `/tour` (Fase 6)
- **Uma execução real, em ordem:** o tour mostra o exemplo 1 (entrada 5) do primeiro ao último frame, sem pular nem repetir. Cada cena cobre um trecho e um tópico do pitch: contexto (antes do boot), arquitetura (o BOOT, com programa e dado na mesma RAM), CPU (`LOAD R0, [0xF0]`), memória/cache/barramentos (`LOAD R1, [0x20]`, com MISS e espera), ciclo completo (`ADD R0, R1`), E/S (`STORE R0, [0xF1]`) e valor pedagógico (`HLT`).
- **Nada é encenado:** as cenas não criam microetapas falsas para destacar componentes; o diagrama mostra sempre a microetapa real do motor, e a fala explica o que está aceso.
- **Tempo:** 20 + 30 + 30 + 35 + 60 + 25 + 20 = **220 s (3min40s)**, exatamente o máximo da §10, deixando 20 s de margem nos 4 minutos do vídeo. Dentro de cada cena, os frames são distribuídos igualmente pela duração; na cena 5, por exemplo, cada uma das 8 microetapas do `ADD` fica 7,5 s na tela.
- **Relógio:** usa o horário real (`performance.now`), não a soma de intervalos, para não atrasar durante a gravação. Espaço pausa e retoma; ← e → trocam de cena.
- **Fonte única das falas:** as cenas ficam em `src/components/tour/scenes.ts`, e o roteiro em `docs/roteiro-video.md`. Um teste lê o roteiro e falha se título, duração, tempo de início/fim ou fala divergirem do tour.
- **Quadro "Memória (RAM)":** a janela da RAM no diagrama acompanha o PC e não mostraria o dado em 0x20. O tour lista as palavras não nulas da RAM, marcando "instrução" ou "dado" segundo a listagem do assembler (`.word`), e não por posição na memória.

### D23 — Página `/sobre` (Fase 6)
- Reúne o contexto da NeoCore (R1), a justificativa da arquitetura (R2), o diagrama geral (R3), os parâmetros, a ISA, a hierarquia de memória, os barramentos e a E/S, o ciclo de instrução, as simplificações e um glossário.
- **Gerada a partir do código, no build:** a tabela da ISA vem de `ISA` (`src/core/isa.ts`); a tabela de microetapas do `ADD R0, R1` e as estatísticas da cache do exemplo 2 vêm da execução real do motor. Assim, a página não pode divergir do simulador, e as tabelas servem diretamente para o relatório (seções 5 e 8).
- A tela inicial ganhou uma linha de contexto e a navegação Simulador · Tour guiado · Sobre, presente nas três páginas.

### D24 — Relatório técnico (Fase 7, `docs/relatorio/`)
- **Fonte:** `docs/relatorio/relatorio.md`, com as seções 1–9 e os apêndices da matriz §11.
- **Capturas reais e reproduzíveis:** as 11 figuras de `docs/relatorio/img/` são geradas por `npm run capturas`, que abre o app real (Playwright, tema claro, movimento reduzido) e fotografa microetapas exatas do exemplo 1 e o fim do exemplo 2. Se o app mudar, basta rodar o comando de novo. O script usa uma configuração própria do Playwright; o único teste E2E da §8 continua sendo `tests/e2e/simulador.spec.ts`.
- **Coerência verificada:** `tests/docs/relatorio.test.ts` confere contra o motor a tabela de microetapas de `ADD R0, R1`, os ciclos de cada instrução do exemplo 1, o código de máquina, as estatísticas da cache, o arquivo `.neocore.json` do Apêndice A e a existência de todas as figuras. Se o simulador mudar e o relatório não, o teste falha.
- **PDF sem dependências novas:** `npm run relatorio:pdf` converte o Markdown (um subconjunto simples, tratado pelo próprio script) e imprime em A4 com o Chromium do Playwright, já instalado para o E2E. Com `RELATORIO_HTML=caminho`, o HTML intermediário também é salvo, para revisão.
- **Campos a preencher** ficam marcados como `⟨preencher: …⟩` e aparecem destacados no PDF. Na versão final, todos foram preenchidos (autor e links da Vercel, do repositório e do vídeo).
- O indicador flutuante do modo de desenvolvimento do Next foi desligado (`devIndicators: false`), porque apareceria nas capturas e na gravação do vídeo.

### D25 — Simulador próprio em vez de ferramenta pronta (Fase 7)
- **O que as ferramentas existentes não cobrem:** o Logisim e o Tinkercad, citados no enunciado, simulam circuitos peça por peça; com eles, a explicação de cada etapa ficaria fora da ferramenta. Simuladores didáticos de CPU, como o Neander (UFRGS) e o Ripes (RISC-V), trazem uma arquitetura definida por outra pessoa.
- **O que o projeto precisava demonstrar:** o enunciado pede para projetar uma arquitetura didática e demonstrar como o computador executa uma instrução e como os dados percorrem a arquitetura, e não apenas desenhar componentes conectados.
- **O que se ganha:** a NeoCore-8 tem só o que a disciplina ensina; a explicação de cada microetapa é gerada pelo próprio motor (R11), e o diagrama mostra apenas o que o motor executou, com o motor coberto por testes.
- Aparece na seção 1 do relatório e na cena 2 do vídeo.

### D26 — Gravação do vídeo pitch (Fase 8)
- O vídeo ([https://youtu.be/KRExI6gs2_I](https://youtu.be/KRExI6gs2_I), 3min57s, não listado) foi gravado na aplicação publicada: primeiro a tela, cena por cena, executando o exemplo 1 com entrada 5; depois a narração, por cima.
- Em vez de gravar só o `/tour` com as legendas, o vídeo segue um roteiro de 9 cenas narrado na primeira pessoa, que inclui o editor, as abas e a justificativa da D25. O `/tour` serviu de guia para a ordem dos tópicos e continua no app como modo guiado para o estudante.
- A estrutura das 9 cenas está em `docs/roteiro-video.md` e no Apêndice B do relatório. O roteiro do tour, sincronizado por teste, não mudou.

## 3. Simplificações declaradas

- **Endereçamento por palavra:** cada endereço contém uma palavra de 16 bits; não há acesso a bytes individuais.
- **Imediato de 8 bits sem sinal** em `LDI` (ver D8); constantes maiores ou negativas ficam na memória.
- **Sem pilha, sub-rotinas ou modos de endereçamento indireto/indexado:** os endereços de `LOAD`/`STORE`/saltos são sempre absolutos e fixos na instrução.
- **Latência fixa da RAM:** todo acesso custa os mesmos 4 ciclos de espera, sem rajadas, refresh ou variação por endereço.
- **Dispositivos de E/S instantâneos:** respondem sem ciclos de espera e sem protocolo de handshake ou status de "pronto"; não há interrupções nem DMA (§2, regra 6).
- **Loader em uma única microetapa:** a cópia disco → RAM é mostrada como uma única etapa, e não palavra a palavra.
- **Sequenciamento estritamente sequencial:** uma microetapa por vez, sem paralelismo entre busca e execução (sem pipeline, §4.1).
- **Cache de 1 palavra por linha:** sem blocos de várias palavras, portanto sem localidade espacial; o ganho vem só da localidade temporal (reuso, como no laço).
- **Posição da cache no diagrama:** a cache aparece entre a CPU e a RAM, ligada ao mesmo conjunto de barramentos. Em um processador real, a L1 fica dentro do chip da CPU. Em um HIT, o dado percorre apenas o trecho CPU ↔ cache, e a RAM não é acionada.
- **Um único nível de cache (L1)**, sem L2/L3 e sem caches separadas de instruções e dados.
- **Latência de HIT absorvida na microetapa:** o ciclo de acesso à cache é o próprio ciclo da microetapa de consulta.
