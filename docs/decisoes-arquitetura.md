# Decisões de arquitetura

Registro das justificativas e simplificações do NeoCore Computer Lab. Este documento alimenta o relatório técnico (seções 2 a 8). A especificação de referência é a §4 do `CLAUDE.md` ("NeoCore-8"); cada decisão abaixo indica a fase em que foi tomada.

## 1. Arquitetura simulada

> Seção a ser detalhada nas fases 1 a 3, à medida que o núcleo for implementado.

Resumo da especificação já definida no `CLAUDE.md` §4:

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

### D4 — `MachineState` provisório (Fase 0)
- `src/core/types.ts` declara um `MachineState` imutável (`readonly`) derivado dos parâmetros da §4.2 e §4.5: registradores, especiais, flags, memória de 256 palavras, cache de 8 linhas com contadores, E/S, disco, ciclo, fase e erro didático.
- A Fase 2 (UC e máquina) pode acrescentar campos internos necessários para avançar microetapa por microetapa. Qualquer mudança será registrada aqui.

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

### D10 — Ciclos de clock (Fase 2, `machine.ts`)
- Cada microetapa da CPU dura **1 ciclo**. Os acessos à RAM (leitura na busca, leitura em `LOAD`, escrita em `STORE`) somam **4 ciclos de espera** (wait states, §4.5), visíveis no campo `waitCycles`.
- O **BOOT não consome ciclos**: o carregamento do disco acontece antes de a CPU começar a executar (§4.5: "apenas no carregamento"). Avançar uma máquina parada também não consome ciclos.
- Resultado sem cache: uma busca custa 8 ciclos (1 + 5 + 1 + 1), e o exemplo 1 termina em **65 ciclos**. A Fase 3 vai reduzir esse número com acertos na cache.

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

### D4 (revisão na Fase 2)
- `MachineState` recebeu `aluOutput` (D9) e `microIndex` (D9). `phase` passou a indicar a fase da **próxima** microetapa (ou `HALT`).

## 3. Simplificações declaradas

- **Endereçamento por palavra:** cada endereço contém uma palavra de 16 bits; não há acesso a bytes individuais.
- **Imediato de 8 bits sem sinal** em `LDI` (ver D8); constantes maiores ou negativas ficam na memória.
- **Sem pilha, sub-rotinas ou modos de endereçamento indireto/indexado:** os endereços de `LOAD`/`STORE`/saltos são sempre absolutos e fixos na instrução.

- **Latência fixa da RAM:** todo acesso custa os mesmos 4 ciclos de espera, sem rajadas, refresh ou variação por endereço.
- **Dispositivos de E/S instantâneos:** respondem sem ciclos de espera e sem protocolo de handshake ou status de "pronto"; não há interrupções nem DMA (§2, regra 6).
- **Loader em uma única microetapa:** a cópia disco → RAM é mostrada como uma única etapa, e não palavra a palavra.
- **Sequenciamento estritamente sequencial:** uma microetapa por vez, sem paralelismo entre busca e execução (sem pipeline, §4.1).

> As simplificações da cache serão acrescentadas na Fase 3.
