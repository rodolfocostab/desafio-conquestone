# Teste técnico – Tarefas

> **Prazo:** envio até **sexta-feira, 17/04, às 11:00**.

---

## Criar duas aplicações

- Utilize **linguagens diferentes**.
- Cada aplicação deve ter **duas rotas**:
  - Uma retornando um **texto fixo**.
  - Outra retornando o **horário atual do servidor**.

## Camada de cache

As respostas das aplicações devem ser cacheadas com **tempos de expiração diferentes**:

| Aplicação | Tempo de cache |
|-----------|------------------|
| Primeira  | 10 segundos      |
| Segunda   | 1 minuto         |

## Facilitar a execução

1. A infraestrutura deve ser fácil de iniciar e rodar com o **menor número de comandos possível**.
2. Implementar **observabilidade**, se possível.

## Desenhar e analisar a infraestrutura

- Criar um **diagrama** representando a arquitetura.
- **Identificar e sugerir** pontos de melhoria.

### Atualizações

- No desenho, mostrar como seria o **fluxo de atualização** de cada componente da infra e do código.
- Identificar e sugerir pontos de melhoria.

## Entrega esperada

- Código-fonte das aplicações e sua respectiva infra.
- Configuração da camada de cache.
- Infraestrutura automatizada para fácil execução.
- Diagrama da infraestrutura com análise e sugestões de melhoria.
- Manter boas práticas e organização no Git.

## Como entregar

Todo o conteúdo gerado no teste deve estar em um **repositório** de uma ferramenta de versionamento de código, **acessível para avaliação**.
