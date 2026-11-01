# NeoCore Computer Lab

Simulador web didático da arquitetura interna de um computador. Ele mostra, microetapa por microetapa, como a CPU **busca, decodifica e executa** instruções e como os dados trafegam entre CPU, cache, memória, armazenamento e dispositivos de E/S pelos barramentos de dados, endereços e controle.

Trabalho final da disciplina **Computer Architecture and Organization** (UniFECAF), como prova de conceito para a empresa fictícia NeoCore Tech.

> **Status:** Fase 0 (setup) concluída. O simulador ainda está em construção.

## Links

- **Aplicação (Vercel):** _a definir na Fase 8_
- **Vídeo pitch (YouTube, não listado):** _a definir_

## Stack

Next.js (App Router, build estático) · TypeScript strict · Tailwind CSS · zustand · framer-motion · Vitest · Playwright.

## Como rodar

Pré-requisito: Node.js 22.12 ou superior (exigência do Vitest 5; desenvolvido com Node 24).

```bash
npm install
npx playwright install chromium   # apenas para os testes E2E

npm run dev        # desenvolvimento em http://localhost:3000
npm test           # testes do núcleo (Vitest)
npm run test:coverage  # testes do núcleo com cobertura (mínimo 90%)
npm run test:e2e   # teste ponta a ponta (Playwright)
npm run lint       # ESLint
npm run build      # build estático em out/
```

## Estrutura

```
src/core/        motor da arquitetura (TypeScript puro, sem React)
src/store/       estado da simulação (zustand)
src/components/  diagrama SVG, painéis, editor e controles
src/app/         páginas: simulador, /sobre e /tour
tests/core/      testes unitários do motor
tests/e2e/       teste ponta a ponta
docs/            decisões de arquitetura, rastreabilidade, relatório e roteiro do vídeo
```

A especificação completa do projeto está em [`CLAUDE.md`](CLAUDE.md). As justificativas técnicas estão em [`docs/decisoes-arquitetura.md`](docs/decisoes-arquitetura.md).
