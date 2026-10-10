# Hdtech — PRD

## Problema
Assistências técnicas precisam registrar celulares e notebooks com evidências, controlar custos/lucro e fluxo de caixa, vender acessórios e manter o cliente informado — sem que o cliente veja o painel da loja.

## Arquitetura
- **Mobile:** Expo SDK 57, React Native, Expo Router, TypeScript, tema centralizado em `frontend/src/theme.ts`.
- **Backend:** FastAPI em `backend/server.py`, rotas com prefixo `/api`.
- **Dados:** MongoDB via Motor; IDs string, projeções sem `_id`.
- **Fotos:** Emergent Object Storage (upload via `POST /api/upload`, leitura via `GET /api/files/{path}`); base64 legado ainda renderiza.
- **Acesso:** app abre na área do CLIENTE; painel da equipe protegido por PIN (env `ADMIN_PIN`, hoje `2798`) → token temporário em `admin_sessions` (Mongo, TTL 12h) enviado como `X-Admin-Token`. Rotas admin protegidas com `Depends(require_admin)`.
- **Pagamento da loja:** Pix manual — checkout exibe a chave (env `STORE_PIX_KEY`, hoje `99991743443`); pedido fica "Aguardando pagamento" até a equipe confirmar em Vendas.

## Personas
- **Equipe/loja (PIN):** OS, produtos, estoque, vendas, caixa, confirmação de pagamentos Pix.
- **Cliente (sem login):** acompanha OS pelo código/link público, conversa no chat e compra acessórios na loja pagando com Pix.

## Requisitos principais
- OS com cliente, aparelho, defeito, checklist, fotos (entrada/reparo/entrega), orçamento e lucro interno.
- Timeline: Recebido → Em análise → Em reparo → Pronto → Entregue.
- Link público `/acompanhar/{codigo}` oculta lucro e custos.
- Chat técnico↔cliente (polling 5s).
- Produtos com custo/venda/margem, estoque com ajustes e alerta de reposição.
- Vendas no balcão (ADM) e pedidos da loja do cliente; baixa automática de estoque.
- Caixa mensal: vendas + OS entregues − despesas = saldo; despesas por categoria.

## Implementado
- **2026-10-10:** MVP de OS (wizard, checklist, fotos, financeiro, chat, tracking) — testado E2E.
- **2026-10-10:** Marca Hdtech (nome, logo/ícone/splash), fotos no Object Storage.
- **2026-10-10:** Produtos, Estoque e Vendas no painel — testado E2E.
- **2026-10-10:** Área do cliente separada + painel com PIN, Caixa com despesas mensais, loja do cliente com Pix, deep link `/acompanhar/{codigo}`, correção do bug crítico do portal (tracking por id/código) — testado E2E (backend 41/41).
- **2026-10-10:** Removidos Mercado Pago e notificações push a pedido do usuário; base de dados limpa para produção.

## Backlog priorizado
- **P0:** (nenhum bloqueante)
- **P1:** aprovação do orçamento pelo cliente no link público; foto dos produtos na loja; relatório financeiro exportável (PDF/CSV).
- **P2:** assinatura digital na entrega, impressão de comprovante, múltiplos usuários da equipe com login próprio, Mercado Pago/push caso o usuário queira retomar.

## Próximas tarefas
1. Deploy (botão Publish) e geração dos builds iOS/Android para uso em produção.
2. Cadastrar produtos reais da loja e validar o fluxo Pix com o primeiro cliente.
3. Aprovação de orçamento pelo cliente com histórico.
