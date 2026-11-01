# CLAUDE.md — NeoCore Computer Lab

> Simulador web didático da arquitetura interna de um computador.
> Trabalho final da disciplina **Computer Architecture and Organization** (UniFECAF).
> Este arquivo é a fonte única de verdade do projeto. Leia-o inteiro antes de escrever qualquer código e consulte-o a cada fase.

---

## 1. Missão

Construa uma aplicação web que **simule, passo a passo, como uma CPU busca, decodifica e executa instruções**, mostrando visualmente o movimento dos dados entre CPU (ULA, Unidade de Controle, registradores), cache, memória principal, armazenamento e dispositivos de E/S, através dos barramentos de dados, endereços e controle.

O simulador é a **Parte Prática (50% da nota)** e também a base visual do **Relatório (25%)** e do **Vídeo Pitch (25%)**. Tudo o que for documentado ou apresentado precisa existir e funcionar no app — e tudo o que o app faz precisa estar justificado na documentação.

**Pergunta que o projeto deve responder:**
> Como os diferentes componentes de um computador trabalham de forma coordenada para buscar, interpretar e executar uma instrução?

O app responde a essa pergunta mostrando, a cada microetapa, **qual componente age, qual barramento é usado, qual sinal de controle é emitido e qual valor muda** — com um texto explicativo em português.

### Contexto do cenário (enunciado)
- Cliente fictício: **NeoCore Tech**, empresa de tecnologia educacional.
- Público do produto: estudantes de escolas técnicas, universidades e centros de formação.
- Dor: alunos estudam registradores, ULA, UC, cache, memória e barramentos de forma isolada e não enxergam a interação entre eles.
- Papel do autor: Analista de Arquitetura de Computadores entregando uma **prova de conceito**.

---

## 2. Regras de ouro (não negociáveis)

1. **Coerência acima de tudo.** Cada requisito do enunciado deve mapear para uma funcionalidade, um arquivo de código, uma seção do relatório e um trecho do vídeo (ver §11 — Matriz de Rastreabilidade). Se algo não estiver na matriz, não implemente; se estiver na matriz, não deixe de implementar.
2. **Motor separado da interface.** Toda a lógica da arquitetura vive em `src/core/` como TypeScript puro, sem React, sem DOM, sem `Date.now()` ou aleatoriedade. A UI apenas lê estados e dispara ações.
3. **Determinismo.** O mesmo programa e a mesma entrada produzem sempre a mesma sequência de microetapas, ciclos e estatísticas de cache.
4. **Fidelidade técnica com simplicidade didática.** Simplificações são permitidas (e esperadas), mas devem ser declaradas e justificadas em `docs/decisoes-arquitetura.md`. Nunca represente algo de forma tecnicamente incorreta para "ficar bonito".
5. **Idioma.** Interface, textos explicativos, comentários de domínio e documentação em **português do Brasil**. Identificadores de código em inglês.
6. **Escopo fechado.** Não adicione: backend, banco de dados, login, pipeline, interrupções, DMA, memória virtual, multiprocessamento. Esses itens aparecem apenas como "trabalhos futuros" no relatório.
7. **Não pule testes do núcleo.** Nenhuma instrução da ISA é considerada pronta sem teste unitário que verifique as microetapas e o estado final.

---

## 3. Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) | Stack de domínio do autor; deploy simples |
| Estilo | Tailwind CSS | Rapidez e consistência visual |
| Diagrama | SVG declarado em componentes React | Controle total de destaque/animação de componentes e barramentos |
| Animação | CSS transitions + `framer-motion` (apenas na UI) | Fluxo de dados animado nos barramentos |
| Estado da UI | `zustand` | Store simples para estado da simulação, histórico e velocidade |
| Testes | Vitest (núcleo) + Playwright (1 fluxo E2E) | Garantir corretude das instruções |
| Deploy | Vercel, build estático (`output: 'export'`) | Link público para avaliação e vídeo |

Sem dependências além dessas sem justificar no PR/commit.

---

## 4. Arquitetura simulada — especificação "NeoCore-8"

### 4.1 Visão geral e justificativa
- **Base: Von Neumann.** Memória única para instruções e dados, acessada por um único conjunto de barramentos. Justificativa: é a arquitetura de referência pedida no enunciado e a mais usada no ensino; permite mostrar o **gargalo de Von Neumann** (busca de instrução e acesso a dado disputam o mesmo barramento, o que aparece na contagem de ciclos).
- **Características RISC incorporadas:**
  - **Load/Store:** só `LOAD` e `STORE` acessam memória; a ULA opera apenas sobre registradores.
  - **Formato de instrução fixo (16 bits):** decodificação simples e visualizável campo a campo.
  - **Conjunto pequeno de instruções (14):** cada uma com microetapas claras.
  - Justificativa: reduz a carga cognitiva do aluno e torna cada etapa do ciclo distinguível.
- **Sem pipeline:** execução estritamente sequencial (uma instrução termina antes da próxima começar), para que cada fase do ciclo seja observável isoladamente. Pipeline é citado como evolução natural.
- **E/S mapeada em memória:** dispositivos ocupam endereços fixos e são acessados com `LOAD`/`STORE`, coerente com a filosofia load/store.

### 4.2 Parâmetros
| Item | Valor |
|---|---|
| Palavra | 16 bits |
| Memória principal | 256 palavras (endereços `0x00`–`0xFF`), endereçamento por palavra |
| Barramento de endereços | 8 bits |
| Barramento de dados | 16 bits |
| Barramento de controle | sinais `MEM_READ`, `MEM_WRITE`, `CLOCK`, `RESET`, `ALU_OP`, `REG_WRITE`, `PC_INC`, `PC_LOAD`, `IR_LOAD`, `HALT` |
| Registradores de uso geral | `R0`–`R3` (16 bits) |
| Registradores especiais | `PC` (8 bits), `IR` (16 bits), `MAR` (8 bits), `MDR` (16 bits), `FLAGS` (Z, N, C, V) |
| Região de E/S | `0xF0` = entrada (teclado), `0xF1` = saída (display), `0xF2` = LED/status. Não cacheável |

### 4.3 Formato de instrução
```
 15    12 11  10 9    8 7              0
[ opcode ][  rd  ][  rs  ][ imm / addr ]
  4 bits   2 bits  2 bits     8 bits
```

### 4.4 ISA
| Opcode | Mnemônico | Operação | Flags |
|---|---|---|---|
| `0x0` | `NOP` | nada | — |
| `0x1` | `LOAD rd, [addr]` | `rd ← M[addr]` | — |
| `0x2` | `STORE rd, [addr]` | `M[addr] ← rd` | — |
| `0x3` | `LDI rd, imm` | `rd ← imm` | — |
| `0x4` | `MOV rd, rs` | `rd ← rs` | — |
| `0x5` | `ADD rd, rs` | `rd ← rd + rs` | Z N C V |
| `0x6` | `SUB rd, rs` | `rd ← rd − rs` | Z N C V |
| `0x7` | `AND rd, rs` | `rd ← rd & rs` | Z N |
| `0x8` | `OR rd, rs` | `rd ← rd \| rs` | Z N |
| `0x9` | `NOT rd` | `rd ← ~rd` | Z N |
| `0xA` | `JMP addr` | `PC ← addr` | — |
| `0xB` | `JZ addr` | se Z=1, `PC ← addr` | — |
| `0xC` | `JN addr` | se N=1, `PC ← addr` | — |
| `0xF` | `HLT` | para a execução | — |

Opcodes `0xD`–`0xE` reservados → erro "instrução inválida" (exibido como exceção didática, não crash).

Exemplos de codificação (usar como casos de teste):
- `LDI R1, 5` → `0011 01 00 00000101` → `0x3405`
- `ADD R1, R2` → `0101 01 10 00000000` → `0x5600`

### 4.5 Hierarquia de memória
| Nível | Representação | Latência simulada |
|---|---|---|
| Registradores | `R0`–`R3`, especiais | 0 ciclos extras |
| Cache L1 | **Mapeamento direto, 8 linhas, 1 palavra/linha**. Endereço = `tag (5 bits) | índice (3 bits)`. Política **write-through, no-write-allocate**. Bit de validade por linha | 1 ciclo |
| Memória principal (RAM) | 256 palavras | +4 ciclos (wait states visíveis) em miss |
| Armazenamento (disco) | Lista de programas salvos; no **boot/reset**, o *loader* copia o programa do disco para a RAM (etapa animada) | apenas no carregamento |

A cache atende **instruções e dados** (unificada, coerente com Von Neumann). A região `0xF0`–`0xFF` ignora a cache. Estatísticas: hits, misses, taxa de acerto, ciclos totais, ciclos economizados vs. sem cache.

### 4.6 Ciclo de máquina (microetapas)
Cada instrução é executada como uma sequência de **microetapas**, e a UI permite avançar uma a uma.

**BUSCA (fetch)**
1. `MAR ← PC` — UC coloca PC no barramento de endereços.
2. UC ativa `MEM_READ`; consulta à cache (HIT ou MISS → acesso à RAM com wait states).
3. `MDR ← M[MAR]` — palavra trafega no barramento de dados.
4. `IR ← MDR`; `PC ← PC + 1` (sinais `IR_LOAD`, `PC_INC`).

**DECODIFICAÇÃO (decode)**
5. UC separa os campos de `IR` (opcode, rd, rs, imm/addr), identifica a instrução e define os sinais de controle da execução. A UI destaca cada campo do IR com cor própria.

**EXECUÇÃO (execute)** — varia por instrução, por exemplo:
- `ADD rd, rs`: 6. ULA recebe `rd` e `rs` (`ALU_OP=ADD`) → 7. resultado e flags → 8. `rd ← resultado` (`REG_WRITE`).
- `LOAD rd, [addr]`: 6. `MAR ← addr` → 7. `MEM_READ` + cache → 8. `MDR ← M[MAR]` → 9. `rd ← MDR`.
- `STORE rd, [addr]`: 6. `MAR ← addr`, `MDR ← rd` → 7. `MEM_WRITE` (atualiza cache se presente e RAM — write-through).
- `JZ addr`: 6. UC testa `Z` → 7. `PC ← addr` (`PC_LOAD`) ou nada.
- Acesso a `0xF0`/`0xF1`: microetapa extra mostrando o dispositivo de E/S respondendo no barramento.

Cada microetapa produz um objeto `MicroStep` (ver §5.2).

---

## 5. Estrutura do código

```
neocore-lab/
├── CLAUDE.md
├── README.md                  # como rodar, link do deploy, link do vídeo
├── docs/
│   ├── decisoes-arquitetura.md   # justificativas e simplificações (alimenta o relatório)
│   ├── rastreabilidade.md        # matriz §11 atualizada
│   ├── relatorio/                # rascunho do relatório técnico (Markdown → PDF)
│   └── roteiro-video.md          # roteiro do pitch de 4 min
├── src/
│   ├── core/                  # TS puro, 100% testado
│   │   ├── types.ts           # CpuState, MicroStep, Instruction, BusActivity...
│   │   ├── isa.ts             # tabela de opcodes, encode/decode
│   │   ├── assembler.ts       # texto → palavras de 16 bits, com erros por linha
│   │   ├── alu.ts             # operações e flags
│   │   ├── cache.ts           # mapeamento direto, write-through
│   │   ├── memory.ts          # RAM + região de E/S
│   │   ├── io.ts              # teclado, display, LED
│   │   ├── controlUnit.ts     # gera a sequência de microetapas por instrução
│   │   ├── machine.ts         # step(), stepInstruction(), run(), reset(), load()
│   │   └── programs.ts        # programas de exemplo
│   ├── store/simulation.ts    # zustand: estado atual, histórico (voltar), velocidade
│   ├── components/
│   │   ├── diagram/           # Cpu, Alu, ControlUnit, RegisterFile, Cache, Ram, Disk, IoDevices, Bus
│   │   ├── panels/            # RegistersPanel, MemoryPanel, CachePanel, StepExplanation, Timeline, Stats
│   │   ├── editor/            # ProgramEditor (assembly) + seletor de exemplos
│   │   └── controls/          # Reset, Microetapa, Instrução, Executar/Pausar, Voltar, Velocidade
│   └── app/
│       ├── page.tsx           # simulador
│       ├── sobre/page.tsx     # arquitetura, ISA e glossário
│       └── tour/page.tsx      # modo roteiro guiado (§10)
└── tests/
    ├── core/*.test.ts
    └── e2e/simulador.spec.ts
```

### 5.1 API do motor
```ts
createMachine(program: Word[], options?): MachineState
step(state): { state: MachineState; micro: MicroStep }        // avança 1 microetapa
stepInstruction(state): { state; micros: MicroStep[] }         // avança até fim da instrução
run(state, maxSteps): { state; micros: MicroStep[] }           // até HLT ou limite (anti-loop infinito)
reset(state): MachineState                                     // volta ao boot e recarrega do disco
```
Estados são **imutáveis**; o histórico na store permite **voltar** microetapas.

### 5.2 Contrato `MicroStep`
```ts
type MicroStep = {
  cycle: number;                       // ciclo de clock acumulado
  phase: 'BOOT' | 'FETCH' | 'DECODE' | 'EXECUTE' | 'HALT';
  instruction?: string;                // ex.: "ADD R1, R2"
  title: string;                       // ex.: "IR ← MDR"
  explanation: string;                 // texto didático pt-BR, 1–3 frases
  activeComponents: ComponentId[];     // o que acender no diagrama
  buses: {
    address?: number;
    data?: number;
    control: ControlSignal[];
  };
  changes: { target: string; from: number; to: number }[];  // registradores/memória alterados
  cache?: { type: 'HIT' | 'MISS' | 'WRITE' | 'BYPASS'; index: number; tag: number };
  waitCycles?: number;
};
```
A UI **nunca** inventa explicações: renderiza exatamente o que o motor retorna.

---

## 6. Interface

### 6.1 Layout (desktop, prioridade; responsivo até tablet)
- **Centro:** diagrama da arquitetura em SVG — CPU (UC, ULA, banco de registradores, PC/IR/MAR/MDR/FLAGS), cache, RAM, disco, teclado, display, LED, e os **três barramentos com cores fixas**: endereços (azul), dados (verde), controle (laranja). Componentes ativos ficam destacados; o valor transmitido "viaja" pelo barramento animado.
- **Topo:** controles + indicador de fase (`BUSCA → DECODIFICAÇÃO → EXECUÇÃO`) com a fase atual em destaque e o contador de ciclos.
- **Lateral direita:** painel "O que está acontecendo" (título + explicação da microetapa), registradores (hex + decimal + binário ao passar o mouse, valores alterados piscam), flags.
- **Inferior:** abas — Memória (tabela hex com PC e endereço acessado destacados), Cache (8 linhas: válido, tag, dado, último evento), Linha do tempo (lista de microetapas clicável), Estatísticas.
- **Lateral esquerda (recolhível):** editor de assembly + exemplos + botão "Montar e carregar".

### 6.2 Controles
`Reset` · `◀ Voltar` · `Próxima microetapa` · `Próxima instrução` · `Executar / Pausar` · `Velocidade (0,25×–4×)` · campo de entrada do teclado (`0xF0`).
Atalhos: `→` microetapa, `Shift+→` instrução, `←` voltar, `Espaço` executar/pausar, `R` reset.

### 6.3 Programas de exemplo (obrigatórios)
1. **Soma simples** — demonstração principal (usada no vídeo):
   ```asm
   LOAD  R0, [0xF0]   ; lê número do teclado (E/S)
   LOAD  R1, [0x20]   ; lê constante da memória
   ADD   R0, R1       ; ULA soma
   STORE R0, [0xF1]   ; mostra no display (E/S)
   HLT
   .org 0x20
   .word 7
   ```
2. **Contador com laço** — mostra `JZ`, flags e **ganho da cache** (instruções do laço viram HIT a partir da 2ª volta).
3. **Lógica bit a bit** — `AND`, `OR`, `NOT` com visualização binária.

### 6.4 Assembler
- Sintaxe: um comando por linha, `;` para comentários, `.org`, `.word`, rótulos (`loop:`), números em decimal ou `0x`.
- Erros exibidos por linha em português ("Linha 3: registrador inválido 'R5'"). Programa inválido não é carregado.
- Mostrar ao lado de cada linha o endereço e o código de máquina gerado (hex e binário com campos coloridos).

### 6.5 Qualidade visual e acessibilidade
- Visual limpo, técnico, sem aparência de template genérico; tema claro e escuro.
- Cor nunca é o único indicador: barramentos também têm rótulo e padrão de traço.
- Contraste AA, navegação por teclado, `prefers-reduced-motion` desativa animações (mantém destaques).

---

## 7. Fases de execução

Trabalhe **uma fase por vez**. Ao fim de cada fase: rode testes, atualize `docs/rastreabilidade.md` e faça commit (`feat(core): ...`, `feat(ui): ...`, `docs: ...`).

| Fase | Entrega | Critério de aceite |
|---|---|---|
| 0. Setup | Next + TS strict + Tailwind + Vitest + Playwright + lint | `npm run build` e `npm test` passam |
| 1. Núcleo ISA | `types`, `isa`, `alu`, `memory`, `assembler` | encode/decode ida e volta para os 14 opcodes; flags da ULA testadas (overflow, zero, negativo) |
| 2. UC e máquina | `controlUnit`, `machine`, `io` | os 3 programas de exemplo rodam até `HLT` com estado final esperado; microetapas de fetch idênticas para toda instrução |
| 3. Cache | `cache.ts` integrada à máquina | testes de HIT/MISS, write-through, bypass de E/S; laço do exemplo 2 mostra taxa de acerto > 0 |
| 4. Diagrama | SVG com todos os componentes e 3 barramentos | cada `ComponentId` e barramento acende conforme `MicroStep` |
| 5. Painéis e controles | registradores, memória, cache, timeline, stats, editor | voltar/avançar consistentes; editor carrega programa próprio |
| 6. Tour e páginas | `/tour`, `/sobre` | tour percorre o exemplo 1 seguindo `roteiro-video.md` |
| 7. Documentação | `decisoes-arquitetura.md`, `relatorio/`, `roteiro-video.md`, README | todos os itens da matriz §11 marcados |
| 8. Deploy e revisão | Vercel + checklist §12 | link público abre sem erros no console |

---

## 8. Testes

- Vitest em `src/core` com cobertura mínima de **90%**.
- Para cada instrução: teste das microetapas (fase, componentes ativos, sinais de controle) e do estado final.
- Testes de regressão "golden": a sequência completa de `MicroStep` do exemplo 1 é salva em snapshot.
- 1 teste E2E: abrir app → carregar exemplo 1 → digitar entrada `5` → executar → display mostra `12`.

---

## 9. Comandos

```bash
npm run dev        # desenvolvimento
npm test           # Vitest
npm run test:e2e   # Playwright
npm run lint
npm run build      # build estático para Vercel
```

---

## 10. Bônus: Modo Roteiro (`/tour`)

Implemente um tour guiado que executa o exemplo 1 em sequência fixa, com **pausas e legendas alinhadas ao `docs/roteiro-video.md`** (uma "cena" por tópico exigido no pitch). Objetivo: o autor grava o vídeo de até 4 minutos navegando pelo tour, sem improviso, garantindo que todos os itens avaliados apareçam na ordem certa e dentro do tempo. Cada cena tem duração-alvo; o total não pode passar de 3min40s, deixando margem.

Cenas mínimas:
1. Objetivo do simulador e problema da NeoCore (≈20s)
2. Arquitetura escolhida: Von Neumann + traços RISC (≈30s)
3. Componentes da CPU: UC, ULA, registradores (≈30s)
4. Memória, cache e barramentos (≈35s)
5. Ciclo fetch–decode–execute ao vivo no exemplo 1 (≈60s)
6. Fluxo da instrução até a E/S (display) (≈25s)
7. Como isso ajuda o estudante (≈20s)

---

## 11. Matriz de rastreabilidade (enunciado → app → relatório → vídeo)

Mantenha esta tabela atualizada em `docs/rastreabilidade.md`, com a coluna "Status".

| # | Requisito do enunciado | Onde no app | Código | Seção do relatório | Cena do vídeo |
|---|---|---|---|---|---|
| R1 | Contextualização NeoCore | `/sobre`, tela inicial | `app/sobre` | 1. Contextualização | 1 |
| R2 | Arquitetura de referência justificada (Von Neumann + RISC) | `/sobre` | `docs/decisoes-arquitetura.md` | 2. Arquitetura escolhida | 2 |
| R3 | Diagrama geral | diagrama SVG (exportar PNG) | `components/diagram` | 3. Diagrama geral | 2–4 |
| R4 | CPU com ULA, UC e registradores | diagrama + painel de registradores | `alu.ts`, `controlUnit.ts` | 4. CPU | 3 |
| R5 | Hierarquia de memória e papel da cache | painel Cache + Stats + disco | `cache.ts`, `memory.ts` | 5. Hierarquia de memória | 4 |
| R6 | Barramentos de dados, endereços e controle | barramentos animados + sinais | `components/diagram/Bus` | 6. Barramentos | 4 |
| R7 | Dispositivos de E/S | teclado, display, LED | `io.ts` | 6.1 E/S mapeada em memória | 6 |
| R8 | Fluxo de comunicação entre componentes | animação + timeline | `machine.ts` | 7. Fluxo de dados | 5–6 |
| R9 | Demonstração visual do ciclo | indicador de fase + microetapas | `controlUnit.ts` | 8. Ciclo fetch–decode–execute | 5 |
| R10 | Simular ≥ 1 instrução com busca, decodificação e execução | exemplos 1–3 | `programs.ts` | 8.1 Execução passo a passo de `ADD R0, R1` | 5 |
| R11 | Etapas identificadas e explicadas | painel "O que está acontecendo" | `MicroStep.explanation` | 8 (tabelas de microetapas) | 5 |
| R12 | Valor pedagógico | `/tour` | `app/tour` | 9. Conclusão e trabalhos futuros | 7 |
| R13 | Arquivo da simulação entregue | repositório + link Vercel + export `.neocore.json` | `README.md` | Apêndice A | — |
| R14 | Vídeo ≤ 4 min no YouTube (não listado) | — | `docs/roteiro-video.md` | Apêndice B (link) | todas |

---

## 12. Entrega final — checklist

**Relatório técnico (PDF)** — escrito a partir de `docs/relatorio/` e `docs/decisoes-arquitetura.md`, com capturas reais do app:
- [ ] contextualização da solução para a NeoCore Tech
- [ ] descrição e justificativa da arquitetura (Von Neumann + RISC, sem pipeline, E/S mapeada)
- [ ] diagrama geral (exportado do app)
- [ ] função da CPU, ULA, UC e registradores
- [ ] hierarquia de memória e papel da cache (com estatística do exemplo 2)
- [ ] barramentos de dados, endereços e controle
- [ ] ciclo fetch–decode–execute detalhado, com tabela de microetapas de uma instrução
- [ ] referências: Tanenbaum, Stallings, materiais da disciplina

**Simulação**
- [ ] deploy na Vercel funcionando
- [ ] repositório público (ou `.zip`) com README
- [ ] exemplos 1–3 rodando até `HLT`

**Vídeo pitch**
- [ ] ≤ 4 minutos, gravado com o `/tour`
- [ ] publicado no YouTube como não listado
- [ ] todos os 7 tópicos do enunciado presentes

**Verificação antes de submeter**
- [ ] PDF, link do app e link do vídeo abrem em janela anônima
- [ ] tudo o que o relatório descreve existe no app (conferir com a matriz §11)

---

## 13. Como trabalhar comigo (instruções ao agente)

- Antes de cada fase, apresente um plano curto (arquivos, funções, testes) e siga-o.
- Se um requisito parecer ambíguo, escolha a interpretação mais fiel ao enunciado, registre a decisão em `docs/decisoes-arquitetura.md` e continue.
- Nunca altere a especificação da §4 silenciosamente; qualquer mudança exige atualizar este arquivo, a matriz e os testes juntos.
- Prefira código legível a código esperto: o projeto será explicado em vídeo e avaliado por um professor.
- Ao terminar uma fase, responda com: o que foi feito, testes executados, itens da matriz concluídos e próxima fase.