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

## 3. Simplificações declaradas

> Será preenchida a partir da Fase 1 (ex.: endereçamento por palavra, latência fixa de RAM, ausência de interrupções e DMA).
