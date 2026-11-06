# Matriz de rastreabilidade

Enunciado → app → relatório → vídeo. Cópia da matriz da §11 do `CLAUDE.md`, com a coluna **Status** atualizada ao fim de cada fase.

Valores de Status: `pendente` · `em andamento` · `concluído`.

| # | Requisito do enunciado | Onde no app | Código | Seção do relatório | Cena do vídeo | Status |
|---|---|---|---|---|---|---|
| R1 | Contextualização NeoCore | `/sobre`, tela inicial | `app/sobre` | 1. Contextualização | 1 | concluído |
| R2 | Arquitetura de referência justificada (Von Neumann + RISC) | `/sobre` | `docs/decisoes-arquitetura.md` | 2. Arquitetura escolhida | 2 | concluído |
| R3 | Diagrama geral | diagrama SVG (exportar PNG) | `components/diagram` | 3. Diagrama geral | 2–4 | concluído |
| R4 | CPU com ULA, UC e registradores | diagrama + painel de registradores | `alu.ts`, `controlUnit.ts` | 4. CPU | 3 | concluído |
| R5 | Hierarquia de memória e papel da cache | painel Cache + Stats + disco | `cache.ts`, `memory.ts` | 5. Hierarquia de memória | 4 | concluído |
| R6 | Barramentos de dados, endereços e controle | barramentos animados + sinais | `components/diagram/Bus` | 6. Barramentos | 4 | concluído |
| R7 | Dispositivos de E/S | teclado, display, LED | `io.ts` | 6.1 E/S mapeada em memória | 6 | concluído |
| R8 | Fluxo de comunicação entre componentes | animação + timeline | `machine.ts` | 7. Fluxo de dados | 5–6 | concluído |
| R9 | Demonstração visual do ciclo | indicador de fase + microetapas | `controlUnit.ts` | 8. Ciclo fetch–decode–execute | 5 | concluído |
| R10 | Simular ≥ 1 instrução com busca, decodificação e execução | exemplos 1–3 | `programs.ts` | 8.1 Execução passo a passo de `ADD R0, R1` | 5 | concluído |
| R11 | Etapas identificadas e explicadas | painel "O que está acontecendo" | `MicroStep.explanation` | 8 (tabelas de microetapas) | 5 | concluído |
| R12 | Valor pedagógico | `/tour` | `app/tour` | 9. Conclusão e trabalhos futuros | 7 | concluído |
| R13 | Arquivo da simulação entregue | repositório + link Vercel + export `.neocore.json` | `README.md` | Apêndice A | — | concluído |
| R14 | Vídeo ≤ 4 min no YouTube (não listado) | — | `docs/roteiro-video.md` | Apêndice B (link) | todas | concluído |

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
- **Fase 3 (Cache):** `cache.ts` implementado e integrado à busca, ao `LOAD` e ao `STORE` (145 testes, cobertura de 100% em `src/core`).
  - **R5 (em andamento):** a hierarquia registradores → cache L1 → RAM → disco está completa no motor. A cache tem mapeamento direto, write-through, no-write-allocate e bypass da E/S, com estatísticas de hits, misses, taxa de acerto e ciclos economizados. O laço do exemplo 2 atinge 23/34 ≈ 68% de acerto e roda em 258 ciclos, contra 350 sem cache. Falta a parte visual (painéis Cache e Stats, Fase 5).
- **Fase 4 (Diagrama):** diagrama SVG em `src/components/diagram/` com os 17 componentes e os 3 barramentos, exportação para PNG e uma prévia navegável na página inicial (162 testes; o SVG é renderizado e conferido em todas as microetapas dos 3 exemplos).
  - **R3 → em andamento:** diagrama geral completo e exportável em PNG; falta a seção 3 do relatório.
  - **R6 → em andamento:** os três barramentos com cor, padrão de traço e rótulo próprios; o trecho em uso acende, com o valor e o sentido da transferência; o barramento de controle mostra os sinais do sistema. Falta a seção 6 do relatório.
  - **R4, R5, R7, R8, R9 (em andamento):** CPU (UC, ULA, flags, registradores), cache, RAM, disco e E/S acendem conforme cada microetapa, e a UC mostra a fase atual. Faltam os painéis, a timeline e o indicador de fase completo (Fase 5).
- **Fase 5 (Painéis e controles):** a tela completa da §6.1 (controles, indicador de fase, editor, painéis e abas), com tema claro/escuro e atalhos (198 testes no Vitest + o fluxo E2E da §8 no Playwright).
  - **R4 e R5 (em andamento):** painel de registradores e flags; abas Memória, Cache e Estatísticas. A parte do app está concluída; faltam as seções 4 e 5 do relatório.
  - **R7 (em andamento):** campo do teclado (0xF0), display e LED no diagrama e na aba Memória. Falta a seção 6.1 do relatório.
  - **R8 e R9 (em andamento):** linha do tempo clicável e indicador BUSCA → DECODIFICAÇÃO → EXECUÇÃO. Faltam as seções 7 e 8 do relatório.
  - **R10 (em andamento):** os 3 exemplos carregam pelo editor e rodam até o `HLT`; o E2E confirma o exemplo 1 (entrada 5 → display 12). Falta a seção 8.1 do relatório.
  - **R11 (em andamento):** o painel "O que está acontecendo" mostra o título, a explicação, a fase, o evento da cache, a espera e as alterações de cada microetapa, e os campos do IR na decodificação. Falta a tabela de microetapas do relatório.
  - **R13 → em andamento:** exportar e importar `.neocore.json` no editor; faltam o README final e o link da Vercel (Fases 7–8).
- **Fase 6 (Tour e páginas):** `/tour` (Modo Roteiro, 7 cenas, 3min40s), `/sobre` e `docs/roteiro-video.md` (206 testes no Vitest; um deles garante que tour e roteiro têm as mesmas cenas, durações e falas).
  - **R1 → em andamento:** contexto da NeoCore em `/sobre` e na tela inicial; cena 1 do tour. Falta a seção 1 do relatório.
  - **R2 → em andamento:** justificativa de Von Neumann + RISC em `/sobre` e na cena 2. Falta a seção 2 do relatório.
  - **R3 (em andamento):** o diagrama geral também aparece em `/sobre`.
  - **R11 (em andamento):** a tabela de microetapas do `ADD R0, R1` em `/sobre` é gerada pelo motor e já serve à seção 8 do relatório.
  - **R12 → em andamento:** o `/tour` está pronto, com a cena 7 sobre o valor pedagógico. Falta a seção 9 do relatório.
  - **R14 → em andamento:** o roteiro do vídeo está escrito e sincronizado com o tour. Falta gravar e publicar o vídeo.
- **Fase 7 (Documentação):** relatório técnico em `docs/relatorio/` (Markdown, 11 capturas reais do app e PDF de 22 páginas), decisões de arquitetura reorganizadas e README final. Um teste confere o relatório contra o motor (213 testes no Vitest).
  - **R1–R12 → concluído:** cada item tem a parte do app, o código, a seção do relatório e a cena do roteiro (tabela abaixo).
  - **R13 (em andamento):** repositório, README, exemplos e `.neocore.json` prontos; falta o link da Vercel (Fase 8), que entra no README e no Apêndice A.
  - **R14 (em andamento):** roteiro e tour prontos (3min40s); falta gravar e publicar o vídeo como não listado e colocar o link no README e no Apêndice B.
- **Fase 8 (Deploy e revisão):** aplicação publicada na Vercel e vídeo pitch publicado no YouTube. Os três links abrem sem login, as três páginas do app carregam sem erros no console, e o teste E2E passa contra o site publicado (verificado em 06/11/2026).
  - **R13 → concluído:** aplicação em [https://computerarch.vercel.app/](https://computerarch.vercel.app/) (as páginas `/`, `/tour` e `/sobre` respondem) e repositório público em [https://github.com/samuel-gonzaga/Computer_Architecture_and_Organization](https://github.com/samuel-gonzaga/Computer_Architecture_and_Organization), com README, exemplos e `.neocore.json`. Os links estão no README e no Apêndice A.
  - **R14 → concluído:** vídeo em [https://youtu.be/KRExI6gs2_I](https://youtu.be/KRExI6gs2_I), não listado, com 3min57s. Foi gravado na aplicação publicada, com narração por cima, em 9 cenas que cobrem os 7 tópicos do pitch (D26). O link está no README, no cabeçalho do relatório e no Apêndice B.

## Verificação item a item (Fase 7)

| # | App | Código | Relatório | Cena do roteiro |
|---|---|---|---|---|
| R1 | `/sobre` §1 e linha de contexto na tela inicial | `src/app/sobre/page.tsx` | 1. Contextualização | 1 |
| R2 | `/sobre` §2 | `docs/decisoes-arquitetura.md` (seção 1) | 2. Arquitetura escolhida (Figura 1) | 2 |
| R3 | diagrama SVG + Exportar PNG | `src/components/diagram/` | 3. Diagrama geral (Figura 2) | 2–4 |
| R4 | diagrama + painel de registradores e flags | `src/core/alu.ts`, `src/core/controlUnit.ts` | 4. CPU (Figura 3) | 3 |
| R5 | abas Cache e Estatísticas, disco no diagrama | `src/core/cache.ts`, `src/core/memory.ts` | 5. Hierarquia de memória (Figuras 4–6) | 4 |
| R6 | barramentos com trecho, valor e sinais | `src/components/diagram/Bus.tsx` | 6. Barramentos | 4 |
| R7 | teclado (campo 0xF0), display e LED | `src/core/io.ts` | 6.1 E/S mapeada em memória (Figuras 7–8) | 6 |
| R8 | animação dos barramentos + linha do tempo | `src/core/machine.ts` | 7. Fluxo de dados (Figura 9) | 5–6 |
| R9 | indicador BUSCA → DECODIFICAÇÃO → EXECUÇÃO | `src/core/controlUnit.ts` | 8. Ciclo (Figura 10) | 5 |
| R10 | exemplos 1–3 no editor | `src/core/programs.ts` | 8.1 `ADD R0, R1` passo a passo | 5 |
| R11 | painel "O que está acontecendo" | `MicroStep.explanation` | 8 e 8.1 (tabelas de microetapas) | 5 |
| R12 | `/tour` | `src/components/tour/`, `src/app/tour/` | 9. Conclusão e trabalhos futuros (Figura 11) | 7 |
| R13 | repositório + `.neocore.json` + aplicação na Vercel | `README.md` | Apêndice A | — |
| R14 | — | `docs/roteiro-video.md` | Apêndice B (link do vídeo) | todas |
