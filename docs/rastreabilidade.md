# Matriz de rastreabilidade

Enunciado → app → relatório → vídeo. Cópia da matriz da §11 do `CLAUDE.md`, com a coluna **Status** atualizada ao fim de cada fase.

Valores de Status: `pendente` · `em andamento` · `concluído`.

| # | Requisito do enunciado | Onde no app | Código | Seção do relatório | Cena do vídeo | Status |
|---|---|---|---|---|---|---|
| R1 | Contextualização NeoCore | `/sobre`, tela inicial | `app/sobre` | 1. Contextualização | 1 | pendente |
| R2 | Arquitetura de referência justificada (Von Neumann + RISC) | `/sobre` | `docs/decisoes-arquitetura.md` | 2. Arquitetura escolhida | 2 | pendente |
| R3 | Diagrama geral | diagrama SVG (exportar PNG) | `components/diagram` | 3. Diagrama geral | 2–4 | pendente |
| R4 | CPU com ULA, UC e registradores | diagrama + painel de registradores | `alu.ts`, `controlUnit.ts` | 4. CPU | 3 | em andamento |
| R5 | Hierarquia de memória e papel da cache | painel Cache + Stats + disco | `cache.ts`, `memory.ts` | 5. Hierarquia de memória | 4 | em andamento |
| R6 | Barramentos de dados, endereços e controle | barramentos animados + sinais | `components/diagram/Bus` | 6. Barramentos | 4 | pendente |
| R7 | Dispositivos de E/S | teclado, display, LED | `io.ts` | 6.1 E/S mapeada em memória | 6 | em andamento |
| R8 | Fluxo de comunicação entre componentes | animação + timeline | `machine.ts` | 7. Fluxo de dados | 5–6 | em andamento |
| R9 | Demonstração visual do ciclo | indicador de fase + microetapas | `controlUnit.ts` | 8. Ciclo fetch–decode–execute | 5 | em andamento |
| R10 | Simular ≥ 1 instrução com busca, decodificação e execução | exemplos 1–3 | `programs.ts` | 8.1 Execução passo a passo de `ADD R0, R1` | 5 | em andamento |
| R11 | Etapas identificadas e explicadas | painel "O que está acontecendo" | `MicroStep.explanation` | 8 (tabelas de microetapas) | 5 | em andamento |
| R12 | Valor pedagógico | `/tour` | `app/tour` | 9. Conclusão e trabalhos futuros | 7 | pendente |
| R13 | Arquivo da simulação entregue | repositório + link Vercel + export `.neocore.json` | `README.md` | Apêndice A | — | pendente |
| R14 | Vídeo ≤ 4 min no YouTube (não listado) | — | `docs/roteiro-video.md` | Apêndice B (link) | todas | pendente |

## Histórico

- **Fase 0 (Setup):** matriz criada; nenhum requisito concluído. `src/core/types.ts` declara o contrato `MicroStep` (base de R8, R9 e R11), sem lógica.
- **Fase 1 (Núcleo ISA):** `isa.ts`, `alu.ts`, `memory.ts` e `assembler.ts` implementados e testados (63 testes, cobertura de 100% em `src/core`).
  - **R4 → em andamento:** ULA concluída (`alu.ts`, flags Z/N/C/V testadas); falta a UC (`controlUnit.ts`, Fase 2) e a parte visual (Fases 4–5).
  - **R5 → em andamento:** RAM e mapa de E/S concluídos (`memory.ts`); falta a cache (`cache.ts`, Fase 3), o disco/loader (Fase 2) e os painéis (Fase 5).
  - Base para R10: o assembler monta o exemplo 1 da §6.3 (verificado em teste); `programs.ts` entra na Fase 2.
- **Fase 2 (UC e máquina):** `controlUnit.ts`, `machine.ts`, `io.ts` e `programs.ts` implementados e testados (126 testes, cobertura de 100% em `src/core`).
  - **R4 (em andamento):** a UC agora sequencia as microetapas; falta a parte visual (Fases 4–5).
  - **R7 → em andamento:** teclado, display e LED mapeados em memória, com a microetapa extra de E/S (`io.ts`); falta a parte visual.
  - **R8 → em andamento:** `machine.ts` produz o fluxo completo de microetapas, com componentes ativos, barramentos e alterações; falta a animação e a timeline.
  - **R9 → em andamento:** fases BOOT → FETCH → DECODE → EXECUTE geradas por `controlUnit.ts`; a busca é idêntica para toda instrução; falta o indicador de fase.
  - **R10 → em andamento:** os 3 exemplos (`programs.ts`) rodam até `HLT` com o estado final esperado; o exemplo 1 com entrada 5 mostra 12 no display em 65 ciclos (snapshot golden em `tests/core/__snapshots__`).
  - **R11 → em andamento:** cada microetapa tem título e explicação em português gerados pelo motor; falta o painel "O que está acontecendo".
