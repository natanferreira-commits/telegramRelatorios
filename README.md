# Radar de Conteúdo (telegramRelatorios)

Lê canais e grupos do Telegram **como uma conta de usuário** e transforma o que
foi postado em relatório: volume por dia, alcance (views), mix de conteúdo
(tip, análise, green/red, cadastro…), horários — dos **nossos** canais e dos
**concorrentes**.

Nasceu do Módulo A do Painel Arena. A diferença que importa é a coleta:

| | Painel antigo (bot + webhook) | Radar (conta de usuário) |
|---|---|---|
| Histórico | só do dia em que o bot entrou pra frente | puxa pra trás (padrão: 45 dias) |
| Servidor/banco caiu | posts daquele período perdidos pra sempre | recupera sozinho na volta (cursor por canal) |
| Onde funciona | só canal onde o bot é admin | qualquer canal/grupo em que a conta entrou |
| Alcance | não tem | views, encaminhamentos e reações por post |

## Como funciona

1. Um **número dedicado** entra nos canais que interessam (pelo app do Telegram, normal).
2. O coletor (`/api/collect`) lista os canais que a conta enxerga → aparecem em **Fontes**.
3. Em **Fontes** você liga o que quer monitorar e diz de quem é (nosso / concorrente).
4. A cada execução, cada fonte continua do último post coletado. Os posts novos
   são categorizados por IA (Claude Haiku).
5. **Conteúdo**, **Comparar períodos** e **Perfis** leem do banco.

## Setup (uma vez)

### 1. Supabase
Crie o projeto e rode `supabase/schema.sql` inteiro no SQL Editor.

### 2. Telegram
- Use um **chip só pra isso**. A sessão gerada dá acesso total à conta — nunca
  use conta pessoal de ninguém.
- Logado com esse número em <https://my.telegram.org> → *API development tools*
  → crie um app e anote `api_id` e `api_hash`.
- No terminal, dentro da pasta do projeto:

  ```bash
  npm install
  ```

  ```bash
  npm run tg:login
  ```

  Ele pede api_id, api_hash, número e o código que chega no Telegram, e grava
  `TG_API_ID`, `TG_API_HASH` e `TG_SESSION` no `.env.local`.

### 3. Variáveis (`.env.local` e Vercel)
Veja `.env.example`. Na Vercel: Settings → Environment Variables, as mesmas chaves.
`PANEL_PASSWORD` e `CRON_SECRET` são obrigatórias em produção.

### 4. Primeira carga (histórico)
A primeira coleta puxa semanas de posts — melhor rodar local, sem limite de tempo:

```bash
npm run collect
```

(Antes, ligue as fontes: rode uma vez pra descobrir os canais, ligue em
`/fontes`, rode de novo.) **Não rode o CLI enquanto o agendamento da Vercel
estiver rodando** — a mesma sessão conectada em dois lugares é derrubada pelo
Telegram. O coletor tem trava, mas evite.

### 5. Agendamento
- `vercel.json` → cron diário (o que o plano grátis da Vercel permite).
- `.github/workflows/coleta.yml` → de hora em hora, só chama a rota na Vercel.
  Precisa dos secrets `COLLECT_URL` e `CRON_SECRET` no repositório.

A coleta de hora em hora também mantém o Supabase grátis acordado (ele pausa
com 7 dias sem atividade — foi o que matou o painel antigo).

## Limites conhecidos
- Em **grupo** (não canal) só entra o que o dono posta (post do canal vinculado
  ou admin anônimo); conversa de membro fica de fora.
- Álbum (várias fotos) conta como um post.
- Views dos últimos 3 dias são atualizadas a cada coleta; depois disso, congelam.
- Tipos (tip/análise/…) dependem da IA: post na fila conta no volume, mas aparece como "outro".
