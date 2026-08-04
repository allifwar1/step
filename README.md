# STEP Agronegócios — Site Institucional

Site de página única da **STEP Agronegócios** (Soluções Tecnológicas para
Estações de Pesquisa), Uberlândia-MG.

## Estrutura

```
├── index.html    ← todo o site (HTML + CSS + JS em um arquivo só)
├── img/          ← imagens (slides, logos, favicon)
└── .nojekyll     ← faz o GitHub Pages servir os arquivos direto, sem processar
```

## Como publicar

**GitHub Pages:** em *Settings → Pages*, escolha a branch `main` e a pasta
`/ (root)`. O site fica no ar em `https://<usuario>.github.io/<repositorio>/`.

**Qualquer outra hospedagem** (Hostinger, HostGator, Netlify, Vercel, cPanel…):
basta enviar o `index.html` e a pasta `img/` para a raiz da hospedagem.
Não há build, banco de dados nem dependência de servidor — é 100% estático.

O formulário de contato e os botões enviam a mensagem direto para o
WhatsApp — não precisa configurar e-mail nem backend.
