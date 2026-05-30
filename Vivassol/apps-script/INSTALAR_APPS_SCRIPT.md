# Instalar Apps Script Vivassol

## 1. Importar a planilha

Importe o arquivo `Banco de Dados Programa Vivassol.xlsx` para o Google Sheets na conta principal `allifwar1@gmail.com`.

Crie/importe tambem a planilha espelho na conta `erllenkaren@gmail.com` com o nome:

`Banco de Dados Programa Vivassol espelho`

## 2. Configurar a aba Configuracoes

Na planilha principal, abra a aba `Configuracoes` e preencha:

- `PRIMARY_SPREADSHEET_ID`: ID da planilha principal
- `BACKUP_SPREADSHEET_ID`: ID da planilha espelho
- `PRIMARY_SPREADSHEET_URL`: link da planilha principal
- `BACKUP_SPREADSHEET_URL`: link da planilha espelho
- `BACKUP_FOLDER_ID`: opcional, ID da pasta de backups na sua conta
- `VIVASSOL_API_TOKEN`: manter o token gerado ou trocar por outro token forte

## 3. Colar o Apps Script

Na planilha principal:

1. Extensoes > Apps Script
2. Apague o conteudo padrao de `Code.gs`
3. Cole o conteudo do arquivo `Code.gs`
4. Salve o projeto

## 4. Testar e autorizar

No editor Apps Script:

1. Selecione a funcao `vivassolTestePing`
2. Clique em Executar
3. Autorize as permissoes solicitadas

Depois execute `vivassolInstalarGatilhos` para criar:

- sincronizacao da planilha espelho a cada 5 minutos
- backup completo diario

## 5. Publicar como aplicativo web

1. Implantar > Nova implantacao
2. Tipo: Aplicativo da Web
3. Executar como: voce
4. Quem tem acesso: qualquer pessoa com o link
5. Copie a URL gerada

## 6. Configurar no sistema

No sistema Vivassol, abra `Configuracoes` e preencha:

- URL da API Apps Script
- TOKEN da API
- ID da planilha principal
- Link da planilha principal
- Link da planilha espelho

Use `Puxar dados da planilha` para testar leitura e `Enviar dados locais para planilha` apenas quando quiser substituir os dados atuais da planilha pelos dados locais do navegador.
