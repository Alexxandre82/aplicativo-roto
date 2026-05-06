# 📋 Manual do Painel do Gestor — Roto CD

**Aplicativo:** Roto CD — Registro de Atividades Invisíveis  
**Versão:** 1.0 — Maio 2026  
**Desenvolvido para:** Roto Fermax  

---

## 1. O que é o Painel do Gestor?

O Painel do Gestor é a tela de gestão e análise do aplicativo **Roto CD**. Ele permite que o responsável pelo setor visualize, em tempo real, quanto tempo a equipe está dedicando às **atividades invisíveis** — ou seja, tarefas que acontecem no Centro de Distribuição mas que não eram registradas antes, como conferência de mercadoria, organização de estoque, importação de pedidos, entre outras.

> O objetivo não é fiscalizar, mas **tornar visível o trabalho real da equipe** para que a gestão possa planejar melhor, redistribuir demandas e reconhecer o esforço de cada operador.

---

## 2. Como acessar

1. Acesse o aplicativo pelo link: **rotocd.vercel.app**
2. Clique em **"Criar Cadastro"**
3. Preencha:
   - **Nome:** Coloque seu nome completo e adicione a palavra **GESTOR** no final  
     _(Exemplo: `Alexandre GESTOR`)_
   - **Matrícula:** Sua matrícula de funcionário
   - **Senha:** Mínimo 4 dígitos
   - **Carga horária:** A sua jornada diária
4. Clique em **"Criar Cadastro"**
5. Faça o login normalmente — o sistema vai reconhecer que você é gestor e abrir o Painel automaticamente

> ⚠️ **Importante:** A palavra GESTOR deve ser a última palavra do nome, em letras maiúsculas, para que o sistema reconheça o perfil correto.

---

## 3. Visão geral da tela

O painel é dividido em três grandes seções:

```
┌─────────────────────────────────────────────────┐
│  HEADER: Logo + botão Sair                      │
├─────────────────────────────────────────────────┤
│  FILTROS: Dia / Semana / Mês  +  Seletor Data   │
├──────────────┬──────────────┬───────────────────┤
│  KPI 1       │  KPI 2       │  KPI 3            │
│  Mão de obra │  Tempo       │  % do tempo       │
│  disponível  │  invisível   │  invisível        │
├──────────────┴──────────────┴───────────────────┤
│  BARRA DE PROGRESSO: Ocupação do tempo          │
├────────────────────┬────────────────────────────┤
│  🍕 PIZZA          │  📊 BARRAS                 │
│  Proporção por     │  Horas por                 │
│  atividade         │  atividade                 │
├────────────────────┼────────────────────────────┤
│  📈 LINHA          │  📈 LINHA                  │
│  Tendência 7 dias  │  Evolução por atividade    │
├─────────────────────────────────────────────────┤
│  BOTÃO: Exportar CSV                            │
└─────────────────────────────────────────────────┘
```

---

## 4. Filtros de período

No topo da tela, você pode filtrar os dados por três períodos:

| Botão | O que mostra |
|-------|-------------|
| **Dia** | Apenas o dia selecionado no calendário |
| **Semana** | A semana inteira que contém a data selecionada (domingo a sábado) |
| **Mês** | O mês inteiro da data selecionada |

Ao lado dos botões, há um **seletor de data** para navegar para dias, semanas ou meses anteriores.

---

## 5. KPIs (Indicadores-chave)

São os três cartões no topo do dashboard.

### 👥 Mão de obra disponível
Representa o **total de horas que a equipe poderia trabalhar** no período selecionado.

- É calculado somando a carga horária de **todos os operadores ativos** multiplicado pelos dias do período.
- **Exemplo:** 5 operadores com 8h21 cada = `2.505 minutos por dia`

### ⏱ Tempo invisível
O **total de horas efetivamente registradas** pela equipe no período. É a soma de todas as atividades concluídas por todos os operadores.

### 📊 % do tempo em invisível
A proporção do tempo disponível que foi registrado como tempo invisível.

| Cor do indicador | Interpretação |
|-----------------|---------------|
| 🟢 Verde | Dentro do esperado (até 15% da jornada em atividades invisíveis) |
| 🟡 Amarelo | Moderado (entre 15% e 30%) |
| 🔴 Vermelho | Atenção — acima de 30% da jornada |

> **Nota:** Percentuais altos não significam necessariamente problema — podem indicar um dia com demanda alta de conferência ou recebimento. Use o contexto para interpretar.

---

## 6. Barra de progresso

Logo abaixo dos KPIs, há uma barra visual que mostra a **ocupação do tempo disponível**.

- A barra vai de 0% a 100%
- A cor muda junto com o indicador de % (verde, amarelo, vermelho)
- Serve para dar uma leitura rápida antes de entrar nos detalhes dos gráficos

---

## 7. Alerta de gargalo

Se uma única atividade representar **40% ou mais** do tempo total invisível do período, um alerta vermelho aparece automaticamente:

> ⚠️ **Gargalo detectado**  
> "Conferir e Armaz. Importação" representa **62%** do tempo invisível no período.

Use esse alerta para identificar quais processos estão consumindo mais tempo da equipe e priorizar melhorias operacionais.

---

## 8. Gráficos

### 🍕 Proporção por atividade (Pizza)
Mostra como o tempo invisível do período está **distribuído entre as atividades**.

- Cada fatia representa uma atividade diferente
- O percentual aparece dentro de cada fatia (fatias menores que 8% não exibem o número para não poluir)
- Ao passar o mouse sobre uma fatia, aparece o tempo exato em horas
- Abaixo do gráfico, uma legenda lista as 6 principais atividades com seus respectivos tempos

**Para que serve:** Identificar quais atividades consomem mais tempo da equipe no período.

---

### 📊 Horas por atividade (Barras horizontais)
Mostra o mesmo conteúdo da pizza, mas em formato de **ranking de barras**, do maior para o menor.

- O eixo horizontal mostra o tempo em horas (ex: `1:30`, `2hr`, `45 min`)
- Ao passar o mouse, aparece o tempo exato
- As barras são ordenadas da mais longa para a mais curta

**Para que serve:** Comparar rapidamente o volume de cada atividade lado a lado.

---

### 📈 Tendência total — 7 dias (Linha)
Mostra a **evolução do tempo invisível total nos últimos 7 dias**, independentemente do filtro de período selecionado.

- Linha azul sólida: tempo invisível registrado por dia
- Linha cinza tracejada: capacidade diária total da equipe
- Quando a linha azul se aproxima ou ultrapassa a cinza, significa que a equipe passou uma parte significativa do dia em atividades invisíveis

**Para que serve:** Ver tendências — o tempo invisível está aumentando? Diminuindo? Há picos em dias específicos?

---

### 📈 Evolução por atividade — 7 dias (Linha)
Similar ao anterior, mas **separado por atividade**. Cada atividade tem uma cor diferente.

- Permite ver se uma atividade específica está crescendo ao longo dos dias
- A legenda mostra os nomes das atividades (nomes longos são truncados com `...`)

**Para que serve:** Rastrear se uma atividade que gerou um gargalo é recorrente ou foi um evento pontual.

---

## 9. Exportar dados (CSV)

Quando há registros no período selecionado, aparece no final da tela o botão:

> ⬇ **Exportar dados (X registros) — CSV**

O arquivo baixado contém as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| **Data** | Data do registro (formato dd/mm/aaaa) |
| **Hora início** | Hora em que a atividade foi iniciada |
| **Hora fim** | Hora em que a atividade foi finalizada |
| **Operador** | Nome do operador que realizou a atividade |
| **Atividade** | Nome da atividade registrada |
| **Duração** | Tempo gasto (em horas, ex: `1:30` ou `45 min`) |
| **Ajuste manual** | `Sim` se o operador ajustou o tempo manualmente, `Não` caso contrário |

> O arquivo é salvo no formato **CSV com separador ponto e vírgula (`;`)** e codificação UTF-8, compatível com o Excel brasileiro.

---

## 10. Boas práticas de uso

- **Consulte diariamente** o filtro de "Dia" no final do expediente para ter uma visão do que aconteceu
- **Use o filtro "Semana"** nas reuniões semanais para apresentar um resumo para a equipe
- **Use o filtro "Mês"** para relatórios mensais e comparação de períodos
- **Exporte o CSV** para arquivar os dados ou criar suas próprias análises no Excel
- **Fique atento aos alertas de gargalo** — eles aparecem automaticamente quando uma atividade domina o período

---

## 11. Perguntas frequentes

**O painel mostra dados de todos os operadores?**  
Sim. Todos os operadores ativos do sistema têm seus registros consolidados no painel do gestor.

**E se o operador esquecer de finalizar uma atividade?**  
O aplicativo detecta atividades abertas por mais de 4 horas e exibe um alerta para o operador. Ele pode ajustar o tempo manualmente na hora de finalizar, e o campo "Ajuste manual" no CSV aparecerá como "Sim".

**Os dados são em tempo real?**  
Sim. Assim que o operador finaliza uma atividade, ela aparece no painel do gestor ao recarregar a página.

**O horário está no fuso do Brasil?**  
Sim. Todos os horários são exibidos no fuso horário do dispositivo (horário de Brasília, UTC-3).

**Posso acessar o painel pelo celular?**  
Sim. O painel é responsivo e funciona em qualquer dispositivo. Para uma experiência melhor no celular, instale o app na tela inicial (no Chrome Android: menu ⋮ → "Adicionar à tela inicial").

---

*Documento gerado automaticamente — Roto CD v1.0 — Maio 2026*
