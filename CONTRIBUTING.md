# Como contribuir

Obrigado pelo interesse em contribuir com o Sismais Assist Chat! 🎉

---

## Formas de contribuir

- 🐛 **Reportar bugs** — encontrou algo errado? Abra uma issue
- 💡 **Sugerir funcionalidades** — tem uma ideia? Compartilhe
- 📝 **Melhorar documentação** — clareza sempre ajuda
- 🔧 **Enviar código** — corrija bugs ou implemente melhorias

---

## Reportando um bug

1. Acesse a aba [Issues](../../issues) do repositório
2. Clique em **New Issue**
3. Descreva o problema com:
   - O que você fez
   - O que esperava acontecer
   - O que aconteceu de fato
   - Prints de tela (se possível)

---

## Enviando código (Pull Request)

### 1. Faça um fork do repositório

Clique em **Fork** no canto superior direito da página do repositório.

### 2. Clone o seu fork

```bash
git clone https://github.com/SEU-USUARIO/sismais-assist-chat-opensource.git
cd sismais-assist-chat-opensource
```

### 3. Crie uma branch para sua mudança

```bash
git checkout -b minha-melhoria
```

Use nomes descritivos:
- `fix/erro-ao-enviar-mensagem`
- `feat/notificacao-por-email`
- `docs/melhorar-readme`

### 4. Faça as mudanças e teste

```bash
npm run dev     # testar localmente
npm run lint    # verificar erros de código
npm run test    # rodar testes automatizados
```

### 5. Faça o commit

```bash
git add .
git commit -m "fix: corrige erro ao enviar mensagem com anexo"
```

### 6. Envie e abra o Pull Request

```bash
git push origin minha-melhoria
```

Depois vá ao GitHub e clique em **Compare & pull request**.

---

## Padrões de código

- TypeScript obrigatório — sem `any` sem justificativa
- Componentes React funcionais
- Mensagens de commit em português ou inglês, claras e descritivas
- Não commitar `.env` ou qualquer chave/segredo

---

## Dúvidas?

Abra uma [issue](../../issues) com a tag `question` ou entre em contato pelo site [sismais.com](https://sismais.com).
