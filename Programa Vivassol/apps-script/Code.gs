/**
 * Vivassol ERP - Apps Script permanente
 *
 * Cole este arquivo no editor do Google Apps Script da planilha principal:
 * "Banco de Dados Programa Vivassol".
 *
 * Estrutura esperada da planilha:
 * - Linha 1: titulo visual da aba
 * - Linha 2: descricao visual da aba
 * - Linha 3: cabecalhos da tabela
 * - Linha 4 em diante: dados
 *
 * A API usa o TOKEN salvo em:
 * Configuracoes -> chave = VIVASSOL_API_TOKEN
 */

var VIVASSOL = {
  VERSION: "2026-05-30.1",
  HEADER_ROW: 3,
  DATA_START_ROW: 4,
  CONFIG_SHEET: "Configuracoes",
  LOG_SHEET: "Logs_Sistema",
  HEALTH_SHEET: "Health_Check",
  BACKUPS_SHEET: "Backups",
  SYNC_QUEUE_SHEET: "Fila_Sincronizacao",
  TOKEN_KEY: "VIVASSOL_API_TOKEN",
  BACKUP_SPREADSHEET_ID_KEY: "BACKUP_SPREADSHEET_ID",
  BACKUP_FOLDER_ID_KEY: "BACKUP_FOLDER_ID",
  DATABASE_ROLE_KEY: "DATABASE_ROLE",
  TABLES: [
    "Configuracoes",
    "Usuarios",
    "Permissoes",
    "Clientes",
    "Produtos",
    "Insumos",
    "Ficha_Tecnica",
    "Precificador",
    "Vendas",
    "Itens_Venda",
    "Personalizacoes",
    "Producao",
    "Estoque",
    "Movimentacoes_Estoque",
    "Fornecedores",
    "Entradas_Fornecedor",
    "Itens_Entrada_Fornecedor",
    "Orcamentos",
    "Itens_Orcamento",
    "Financeiro",
    "Pagamentos",
    "Integracoes",
    "Agentes",
    "Logs_Agentes",
    "Logs_Sistema",
    "Aprovacoes",
    "Fila_Sincronizacao",
    "Backups",
    "Health_Check",
    "Aux_Listas"
  ],
  FRONTEND_TABLE_MAP: {
    configuracoes: "Configuracoes",
    usuarios: "Usuarios",
    permissoes: "Permissoes",
    clientes: "Clientes",
    produtos: "Produtos",
    produtosFinais: "Produtos",
    insumos: "Insumos",
    fichaTecnica: "Ficha_Tecnica",
    precificador: "Precificador",
    vendas: "Vendas",
    itensVenda: "Itens_Venda",
    personalizacoes: "Personalizacoes",
    producao: "Producao",
    estoque: "Estoque",
    movimentacoesEstoque: "Movimentacoes_Estoque",
    fornecedores: "Fornecedores",
    entradasFornecedor: "Entradas_Fornecedor",
    itensEntradaFornecedor: "Itens_Entrada_Fornecedor",
    orcamentos: "Orcamentos",
    itensOrcamento: "Itens_Orcamento",
    financeiro: "Financeiro",
    pagamentos: "Pagamentos",
    integracoes: "Integracoes",
    agentes: "Agentes",
    logsAgentes: "Logs_Agentes",
    logsSistema: "Logs_Sistema",
    aprovacoes: "Aprovacoes",
    filaSincronizacao: "Fila_Sincronizacao",
    backups: "Backups",
    healthCheck: "Health_Check"
  }
};

function doGet(e) {
  return handleRequest_(function () {
    var action = getAction_(e, "ping");

    if (action === "ping") {
      return ping_();
    }

    validateToken_(getRequestToken_(e, null));

    if (action === "readAll") {
      return {
        status: "sucesso",
        action: action,
        data: readAllTables_(),
        meta: getMeta_()
      };
    }

    if (action === "healthCheck") {
      return healthCheck_();
    }

    if (action === "readTable") {
      var table = getParam_(e, "table");
      assertTableName_(table);
      return {
        status: "sucesso",
        action: action,
        table: table,
        data: readTable_(table)
      };
    }

    throw new Error("Acao GET nao reconhecida: " + action);
  });
}

function doPost(e) {
  return handleRequest_(function () {
    var body = parseBody_(e);
    var action = body.action || getAction_(e, "");

    if (action !== "ping") {
      validateToken_(body.token || getRequestToken_(e, null));
    }

    return withLock_(function () {
      if (action === "ping") {
        return ping_();
      }

      if (action === "replaceAll") {
        var result = replaceAll_(body.payload || body.data || {}, body.options || {});
        return success_(action, result);
      }

      if (action === "appendRow") {
        var appended = appendRecord_(body.table, body.record || {});
        return success_(action, { table: body.table, record: appended });
      }

      if (action === "upsertRow") {
        var upserted = upsertRecord_(body.table, body.record || {}, body.idField || "id");
        return success_(action, { table: body.table, record: upserted });
      }

      if (action === "deleteRow") {
        var deleted = deleteRecord_(body.table, body.id, body.idField || "id");
        return success_(action, { table: body.table, deleted: deleted });
      }

      if (action === "createVendaCompleta") {
        var venda = createVendaCompleta_(body.payload || {});
        return success_(action, venda);
      }

      if (action === "syncBackup") {
        var sync = syncBackup_();
        return success_(action, sync);
      }

      if (action === "backupNow") {
        var backup = backupNow_(body.label || "");
        return success_(action, backup);
      }

      if (action === "healthCheck") {
        return healthCheck_();
      }

      if (action === "setupTriggers") {
        var triggers = setupTriggers_();
        return success_(action, triggers);
      }

      if (action === "removeTriggers") {
        var removed = removeVivassolTriggers_();
        return success_(action, removed);
      }

      throw new Error("Acao POST nao reconhecida: " + action);
    });
  });
}

/**
 * Funcao manual para testar dentro do editor Apps Script.
 */
function vivassolTestePing() {
  Logger.log(JSON.stringify(ping_(), null, 2));
}

/**
 * Funcao manual para criar gatilhos:
 * - syncBackupTrigger: a cada 5 minutos
 * - dailyBackupTrigger: 1 vez por dia
 */
function vivassolInstalarGatilhos() {
  Logger.log(JSON.stringify(setupTriggers_(), null, 2));
}

function syncBackupTrigger() {
  handleTrigger_("syncBackupTrigger", function () {
    return syncBackup_();
  });
}

function dailyBackupTrigger() {
  handleTrigger_("dailyBackupTrigger", function () {
    return backupNow_("automatico_diario");
  });
}

function handleTrigger_(name, callback) {
  try {
    var result = callback();
    addSystemLog_("trigger", name + " executado com sucesso.", "system", "Apps Script", "Sucesso");
    updateHealth_("Trigger " + name, "Online", "", JSON.stringify(result));
  } catch (err) {
    addSystemLog_("trigger_error", name + " falhou: " + err.message, "system", "Apps Script", "Erro");
    updateHealth_("Trigger " + name, "Falha", "", err.message);
    throw err;
  }
}

function ping_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    status: "sucesso",
    action: "ping",
    app: "Vivassol ERP",
    version: VIVASSOL.VERSION,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    role: getConfigValue_(VIVASSOL.DATABASE_ROLE_KEY, "PRIMARY"),
    serverTime: new Date().toISOString()
  };
}

function healthCheck_() {
  var start = new Date().getTime();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfigMap_();
  var backupId = config[VIVASSOL.BACKUP_SPREADSHEET_ID_KEY] || "";
  var backupStatus = "Nao configurado";
  var backupName = "";

  if (backupId) {
    try {
      var backup = SpreadsheetApp.openById(backupId);
      backupName = backup.getName();
      backupStatus = "Acessivel";
    } catch (err) {
      backupStatus = "Falha: " + err.message;
    }
  }

  var elapsed = new Date().getTime() - start;
  var result = {
    status: "sucesso",
    action: "healthCheck",
    primary: {
      id: ss.getId(),
      name: ss.getName(),
      role: config[VIVASSOL.DATABASE_ROLE_KEY] || "PRIMARY",
      tables: VIVASSOL.TABLES.length
    },
    backup: {
      id: backupId,
      name: backupName,
      status: backupStatus
    },
    latencyMs: elapsed,
    serverTime: new Date().toISOString()
  };

  updateHealth_("Apps Script API", "Online", elapsed, JSON.stringify(result));
  return result;
}

function readAllTables_() {
  var data = {};
  for (var i = 0; i < VIVASSOL.TABLES.length; i++) {
    var table = VIVASSOL.TABLES[i];
    var sheet = getSheetOrNull_(table);
    if (sheet) {
      data[table] = readTable_(table);
    }
  }
  return data;
}

function readTable_(table) {
  assertTableName_(table);
  var sheet = getRequiredSheet_(table);
  var headers = getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < VIVASSOL.DATA_START_ROW) return [];

  var numRows = lastRow - VIVASSOL.DATA_START_ROW + 1;
  var values = sheet.getRange(VIVASSOL.DATA_START_ROW, 1, numRows, headers.length).getValues();
  var rows = [];

  for (var r = 0; r < values.length; r++) {
    if (isEmptyRow_(values[r])) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = serializeCell_(values[r][c]);
    }
    rows.push(obj);
  }
  return rows;
}

function replaceAll_(payload, options) {
  var tables = normalizePayloadTables_(payload);
  var written = [];
  var skipped = [];

  for (var table in tables) {
    if (!tables.hasOwnProperty(table)) continue;
    assertTableName_(table);

    if (table === VIVASSOL.CONFIG_SHEET && !options.includeConfig) {
      updateConfigFromObject_(tables[table]);
      written.push({ table: table, mode: "update-config" });
      continue;
    }

    if (!Array.isArray(tables[table])) {
      skipped.push({ table: table, reason: "Payload nao e lista" });
      continue;
    }

    writeTable_(table, tables[table]);
    written.push({ table: table, rows: tables[table].length });
  }

  addSystemLog_("replaceAll", "Dados substituidos via API.", "api", "WebApp", "Sucesso");
  enqueueSync_("Sistema", "replaceAll", "REPLACE_ALL", { written: written });
  return { written: written, skipped: skipped };
}

function normalizePayloadTables_(payload) {
  if (!payload) return {};
  if (payload.sheets) return payload.sheets;
  if (payload.tables) return payload.tables;

  var result = {};
  for (var key in payload) {
    if (!payload.hasOwnProperty(key)) continue;
    var table = VIVASSOL.FRONTEND_TABLE_MAP[key] || key;
    if (VIVASSOL.TABLES.indexOf(table) >= 0) {
      result[table] = payload[key];
    }
  }
  return result;
}

function writeTable_(table, rows) {
  var sheet = getRequiredSheet_(table);
  var headers = getHeaders_(sheet);
  clearTableData_(sheet, headers.length);
  if (!rows || !rows.length) return;

  var matrix = [];
  for (var i = 0; i < rows.length; i++) {
    matrix.push(recordToRow_(rows[i], headers));
  }

  sheet.getRange(VIVASSOL.DATA_START_ROW, 1, matrix.length, headers.length).setValues(matrix);
}

function appendRecord_(table, record) {
  assertTableName_(table);
  var sheet = getRequiredSheet_(table);
  var headers = getHeaders_(sheet);
  var normalized = normalizeRecordForTable_(table, record, headers);
  sheet.appendRow(recordToRow_(normalized, headers));
  return normalized;
}

function upsertRecord_(table, record, idField) {
  assertTableName_(table);
  var sheet = getRequiredSheet_(table);
  var headers = getHeaders_(sheet);
  var idCol = headers.indexOf(idField);
  if (idCol < 0) throw new Error("Campo de ID nao encontrado em " + table + ": " + idField);

  var normalized = normalizeRecordForTable_(table, record, headers);
  var id = normalized[idField];
  if (!id) throw new Error("Registro sem ID para upsert em " + table);

  var row = findRowByValue_(sheet, idCol + 1, id);
  var values = recordToRow_(normalized, headers);
  if (row) {
    sheet.getRange(row, 1, 1, headers.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
  enqueueSync_(table, id, "UPSERT", normalized);
  return normalized;
}

function deleteRecord_(table, id, idField) {
  assertTableName_(table);
  if (!id) throw new Error("ID obrigatorio para excluir.");
  var sheet = getRequiredSheet_(table);
  var headers = getHeaders_(sheet);
  var idCol = headers.indexOf(idField);
  if (idCol < 0) throw new Error("Campo de ID nao encontrado em " + table + ": " + idField);
  var row = findRowByValue_(sheet, idCol + 1, id);
  if (!row) return false;
  sheet.deleteRow(row);
  enqueueSync_(table, id, "DELETE", { id: id });
  return true;
}

function createVendaCompleta_(payload) {
  if (!payload) throw new Error("Payload da venda obrigatorio.");
  if (!payload.venda) throw new Error("payload.venda obrigatorio.");
  if (!payload.itens || !payload.itens.length) throw new Error("A venda precisa ter ao menos 1 item.");

  var venda = payload.venda;
  if (!venda.id) venda.id = makeId_("ven");
  if (!venda.cliente_id) throw new Error("Toda venda precisa ter cliente_id.");
  if (!venda.cliente_nome) venda.cliente_nome = findNameById_("Clientes", venda.cliente_id);

  var total = 0;
  var itens = [];
  for (var i = 0; i < payload.itens.length; i++) {
    var item = payload.itens[i];
    if (!item.id) item.id = makeId_("itv");
    item.venda_id = venda.id;
    if (!item.produto_id) throw new Error("Todo item precisa ter produto_id.");
    if (!item.produto_nome) item.produto_nome = findNameById_("Produtos", item.produto_id);
    if (!item.quantidade) item.quantidade = 1;
    item.subtotal = toNumber_(item.subtotal) || (toNumber_(item.quantidade) * toNumber_(item.preco_unitario));
    total += toNumber_(item.subtotal) - toNumber_(item.desconto_item);
    itens.push(item);
  }

  venda.valor_total = toNumber_(venda.valor_total) || total + toNumber_(venda.entrega_valor);
  venda.valor_pago = sumPagamentosPayload_(payload.pagamentos || []);
  venda.valor_pendente = Math.max(0, toNumber_(venda.valor_total) - toNumber_(venda.valor_pago));
  venda.percentual_pago = venda.valor_total ? round2_((venda.valor_pago / venda.valor_total) * 100) : 0;
  venda.status_pagamento = venda.status_pagamento || statusPagamentoFromValores_(venda.valor_total, venda.valor_pago);
  venda.status_pedido = venda.status_pedido || "Pedido recebido";
  venda.criado_em = venda.criado_em || new Date().toISOString();
  venda.atualizado_em = new Date().toISOString();
  venda.sync_status = "Pendente";

  upsertRecord_("Vendas", venda, "id");
  for (var j = 0; j < itens.length; j++) upsertRecord_("Itens_Venda", itens[j], "id");

  var pagamentos = payload.pagamentos || [];
  for (var p = 0; p < pagamentos.length; p++) {
    var pagamento = pagamentos[p];
    if (!pagamento.id) pagamento.id = makeId_("pag");
    pagamento.venda_id = venda.id;
    appendRecord_("Pagamentos", pagamento);
  }

  var personalizacoes = payload.personalizacoes || [];
  for (var x = 0; x < personalizacoes.length; x++) {
    if (!personalizacoes[x].id) personalizacoes[x].id = makeId_("per");
    appendRecord_("Personalizacoes", personalizacoes[x]);
  }

  if (payload.criar_producao !== false) {
    for (var k = 0; k < itens.length; k++) {
      appendRecord_("Producao", {
        id: makeId_("prd"),
        venda_id: venda.id,
        item_venda_id: itens[k].id,
        status: venda.status_pedido,
        prazo: venda.prazo || "",
        responsavel_id: "",
        prioridade: "Normal",
        observacoes: "",
        atualizado_em: new Date().toISOString()
      });
    }
  }

  addSystemLog_("createVendaCompleta", "Venda " + venda.id + " criada/atualizada.", venda.usuario_id || "api", "WebApp", "Sucesso");
  return { venda: venda, itens: itens, pagamentos: pagamentos };
}

function syncBackup_() {
  var source = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfigMap_();
  var backupId = config[VIVASSOL.BACKUP_SPREADSHEET_ID_KEY];
  if (!backupId) throw new Error("BACKUP_SPREADSHEET_ID nao configurado na aba Configuracoes.");

  var target = SpreadsheetApp.openById(backupId);
  cloneSpreadsheetTabs_(source, target);

  var result = {
    sourceId: source.getId(),
    sourceName: source.getName(),
    targetId: target.getId(),
    targetName: target.getName(),
    syncedAt: new Date().toISOString(),
    sheets: source.getSheets().length
  };

  addSystemLog_("syncBackup", "Planilha espelho sincronizada.", "system", "Apps Script", "Sucesso");
  updateHealth_("Planilha espelho", "Online", "", JSON.stringify(result));
  return result;
}

function cloneSpreadsheetTabs_(source, target) {
  var tempName = "__VIVASSOL_SYNC_TEMP__" + new Date().getTime();
  var temp = target.insertSheet(tempName);
  var targetSheets = target.getSheets();

  for (var i = 0; i < targetSheets.length; i++) {
    if (targetSheets[i].getSheetId() !== temp.getSheetId()) {
      target.deleteSheet(targetSheets[i]);
    }
  }

  var sourceSheets = source.getSheets();
  for (var j = 0; j < sourceSheets.length; j++) {
    var sourceSheet = sourceSheets[j];
    var copied = sourceSheet.copyTo(target);
    copied.setName(sourceSheet.getName());
    if (sourceSheet.isSheetHidden()) copied.hideSheet();
  }

  target.deleteSheet(temp);
  target.setActiveSheet(target.getSheets()[0]);
}

function backupNow_(label) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfigMap_();
  var folderId = config[VIVASSOL.BACKUP_FOLDER_ID_KEY] || "";
  var tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  var stamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd_HH-mm-ss");
  var name = "backup Banco de Dados Programa Vivassol - " + stamp + (label ? " - " + label : "");
  var sourceFile = DriveApp.getFileById(ss.getId());
  var copy = folderId ? sourceFile.makeCopy(name, DriveApp.getFolderById(folderId)) : sourceFile.makeCopy(name);

  var record = {
    id: makeId_("bkp"),
    data: new Date().toISOString(),
    tipo: label || "Manual",
    arquivo_nome: name,
    arquivo_url: copy.getUrl(),
    spreadsheet_id_origem: ss.getId(),
    spreadsheet_id_destino: copy.getId(),
    status: "Criado",
    observacoes: "Backup completo criado pelo Apps Script."
  };

  appendRecord_(VIVASSOL.BACKUPS_SHEET, record);
  addSystemLog_("backupNow", "Backup criado: " + name, "system", "Apps Script", "Sucesso");
  updateHealth_("Backup diario", "Online", "", JSON.stringify(record));
  return record;
}

function setupTriggers_() {
  removeVivassolTriggers_();
  ScriptApp.newTrigger("syncBackupTrigger").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("dailyBackupTrigger").timeBased().everyDays(1).atHour(2).create();
  addSystemLog_("setupTriggers", "Gatilhos instalados: sync 5 min e backup diario.", "system", "Apps Script", "Sucesso");
  return { syncBackup: "every 5 minutes", dailyBackup: "daily at 02:00" };
}

function removeVivassolTriggers_() {
  var names = ["syncBackupTrigger", "dailyBackupTrigger"];
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (names.indexOf(triggers[i].getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return { removed: removed };
}

function updateConfigFromObject_(rowsOrObject) {
  var updates = {};
  if (Array.isArray(rowsOrObject)) {
    for (var i = 0; i < rowsOrObject.length; i++) {
      if (rowsOrObject[i].chave) updates[rowsOrObject[i].chave] = rowsOrObject[i].valor;
    }
  } else {
    updates = rowsOrObject || {};
  }

  var sheet = getRequiredSheet_(VIVASSOL.CONFIG_SHEET);
  var headers = getHeaders_(sheet);
  var keyCol = headers.indexOf("chave") + 1;
  var valueCol = headers.indexOf("valor") + 1;
  var updatedAtCol = headers.indexOf("atualizado_em") + 1;
  if (!keyCol || !valueCol) throw new Error("Configuracoes precisa ter colunas chave e valor.");

  for (var key in updates) {
    if (!updates.hasOwnProperty(key)) continue;
    var row = findRowByValue_(sheet, keyCol, key);
    if (row) {
      sheet.getRange(row, valueCol).setValue(updates[key]);
      if (updatedAtCol) sheet.getRange(row, updatedAtCol).setValue(new Date().toISOString());
    }
  }
}

function enqueueSync_(table, id, operation, payload) {
  var sheet = getSheetOrNull_(VIVASSOL.SYNC_QUEUE_SHEET);
  if (!sheet) return;
  appendRecord_(VIVASSOL.SYNC_QUEUE_SHEET, {
    id: makeId_("sync"),
    data: new Date().toISOString(),
    origem_tabela: table,
    origem_id: id,
    operacao: operation,
    payload_json: JSON.stringify(payload || {}),
    tentativas: 0,
    status: "Pendente",
    ultimo_erro: "",
    processado_em: ""
  });
}

function updateHealth_(service, status, latencyMs, details) {
  var sheet = getSheetOrNull_(VIVASSOL.HEALTH_SHEET);
  if (!sheet) return;
  appendRecord_(VIVASSOL.HEALTH_SHEET, {
    id: makeId_("hlt"),
    data: new Date().toISOString(),
    servico: service,
    status: status,
    latencia_ms: latencyMs,
    ultima_resposta: new Date().toISOString(),
    detalhes: details || ""
  });
}

function addSystemLog_(type, description, userId, origin, status) {
  var sheet = getSheetOrNull_(VIVASSOL.LOG_SHEET);
  if (!sheet) return;
  appendRecord_(VIVASSOL.LOG_SHEET, {
    id: makeId_("log"),
    data: new Date().toISOString(),
    tipo: type,
    descricao: description,
    usuario_id: userId || "system",
    origem: origin || "Apps Script",
    ip_dispositivo: "",
    status: status || "Sucesso"
  });
}

function getConfigMap_() {
  var sheet = getSheetOrNull_(VIVASSOL.CONFIG_SHEET);
  var config = {};
  if (!sheet) return config;
  var rows = readTable_(VIVASSOL.CONFIG_SHEET);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].chave) config[rows[i].chave] = rows[i].valor;
  }
  return config;
}

function getConfigValue_(key, fallback) {
  var config = getConfigMap_();
  return config[key] || fallback || "";
}

function validateToken_(token) {
  var expected = getConfigValue_(VIVASSOL.TOKEN_KEY, "");
  if (!expected) throw new Error("VIVASSOL_API_TOKEN nao configurado na aba Configuracoes.");
  if (!token || String(token).trim() !== String(expected).trim()) {
    throw new Error("TOKEN invalido ou ausente.");
  }
}

function getMeta_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    version: VIVASSOL.VERSION,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    role: getConfigValue_(VIVASSOL.DATABASE_ROLE_KEY, "PRIMARY"),
    generatedAt: new Date().toISOString()
  };
}

function normalizeRecordForTable_(table, record, headers) {
  record = applyTableAliases_(table, record || {});
  var normalized = {};
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    normalized[key] = record[key] !== undefined ? record[key] : "";
  }

  if (headers.indexOf("id") >= 0 && !normalized.id) {
    normalized.id = makeId_(prefixForTable_(table));
  }

  if (headers.indexOf("criado_em") >= 0 && !normalized.criado_em) {
    normalized.criado_em = new Date().toISOString();
  }

  if (headers.indexOf("atualizado_em") >= 0) {
    normalized.atualizado_em = new Date().toISOString();
  }

  return normalized;
}

function applyTableAliases_(table, record) {
  var out = {};
  for (var key in record) {
    if (record.hasOwnProperty(key)) out[key] = record[key];
  }

  if (table === "Produtos") {
    if (!out.modo_estoque) out.modo_estoque = "Sob demanda";
    if (!out.preco_sugerido && out.preco_venda) out.preco_sugerido = out.preco_venda;
    if (!out.status) out.status = "Ativo";
  }

  if (table === "Vendas") {
    if (!out.valor_total && out.total !== undefined) out.valor_total = out.total;
    if (!out.status_pagamento && out.pagamento_status) out.status_pagamento = out.pagamento_status;
    if (!out.status_pedido && out.producao_status) out.status_pedido = out.producao_status;
    if (!out.forma_pagamento_principal && out.pagamento) out.forma_pagamento_principal = out.pagamento;
    if (!out.entrega_valor && out.entrega_valor !== 0 && record.frete) out.entrega_valor = record.frete;
    if (!out.entrega_status && record.entrega_status) out.entrega_status = record.entrega_status;
    if (!out.entrega_tipo) out.entrega_tipo = out.tipo === "Ecommerce" ? "Marketplace" : "A combinar";
    if (!out.cliente_nome && out.cliente_id) out.cliente_nome = findNameById_("Clientes", out.cliente_id);
    if (out.valor_pago === undefined || out.valor_pago === "") {
      out.valor_pago = out.status_pagamento === "Pago" ? toNumber_(out.valor_total) : 0;
    }
    if (out.valor_pendente === undefined || out.valor_pendente === "") {
      out.valor_pendente = Math.max(0, toNumber_(out.valor_total) - toNumber_(out.valor_pago));
    }
    if (out.percentual_pago === undefined || out.percentual_pago === "") {
      out.percentual_pago = toNumber_(out.valor_total) ? round2_((toNumber_(out.valor_pago) / toNumber_(out.valor_total)) * 100) : 0;
    }
    if (!out.pagamento_entrada_previsto) out.pagamento_entrada_previsto = round2_(toNumber_(out.valor_total) * 0.5);
    if (!out.status_pagamento) out.status_pagamento = statusPagamentoFromValores_(out.valor_total, out.valor_pago);
    if (!out.status_pedido) out.status_pedido = "Pedido recebido";
    if (!out.sync_status) out.sync_status = "Pendente";
  }

  if (table === "Itens_Venda") {
    if (!out.produto_nome && out.produto_id) out.produto_nome = findNameById_("Produtos", out.produto_id);
    if (!out.modo_estoque && out.produto_id) out.modo_estoque = findFieldById_("Produtos", out.produto_id, "modo_estoque") || "Sob demanda";
    if (!out.estoque_acao) {
      out.estoque_acao = out.modo_estoque === "Produto pronto" ? "Reservar produto pronto" : "Reservar insumos";
    }
  }

  if (table === "Pagamentos") {
    if (!out.tipo_pagamento) out.tipo_pagamento = out.status === "Pago" ? "Pagamento integral" : "Parcial";
  }

  return out;
}

function recordToRow_(record, headers) {
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push(record[headers[i]] !== undefined ? record[headers[i]] : "");
  }
  return row;
}

function getHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error("Aba sem colunas: " + sheet.getName());
  var headers = sheet.getRange(VIVASSOL.HEADER_ROW, 1, 1, lastColumn).getValues()[0];
  var clean = [];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) clean.push(String(headers[i]).trim());
  }
  if (!clean.length) throw new Error("Cabecalho nao encontrado na linha " + VIVASSOL.HEADER_ROW + " da aba " + sheet.getName());
  return clean;
}

function clearTableData_(sheet, colCount) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= VIVASSOL.DATA_START_ROW) {
    sheet.getRange(VIVASSOL.DATA_START_ROW, 1, lastRow - VIVASSOL.DATA_START_ROW + 1, colCount).clearContent();
  }
}

function findRowByValue_(sheet, column, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < VIVASSOL.DATA_START_ROW) return null;
  var values = sheet.getRange(VIVASSOL.DATA_START_ROW, column, lastRow - VIVASSOL.DATA_START_ROW + 1, 1).getValues();
  var target = String(value);
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === target) return VIVASSOL.DATA_START_ROW + i;
  }
  return null;
}

function findNameById_(table, id) {
  var rows = readTable_(table);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i].nome || rows[i].cliente_nome || rows[i].produto_nome || "";
  }
  return "";
}

function findFieldById_(table, id, field) {
  var rows = readTable_(table);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i][field] || "";
  }
  return "";
}

function getRequiredSheet_(name) {
  var sheet = getSheetOrNull_(name);
  if (!sheet) throw new Error("Aba nao encontrada: " + name);
  return sheet;
}

function getSheetOrNull_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function assertTableName_(table) {
  if (!table || VIVASSOL.TABLES.indexOf(table) < 0) {
    throw new Error("Tabela nao permitida ou inexistente: " + table);
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error("Payload invalido. Envie JSON em text/plain ou application/json.");
  }
}

function getAction_(e, fallback) {
  return getParam_(e, "action") || fallback || "";
}

function getParam_(e, key) {
  return e && e.parameter && e.parameter[key] ? String(e.parameter[key]) : "";
}

function getRequestToken_(e, fallback) {
  return getParam_(e, "token") || fallback || "";
}

function handleRequest_(callback) {
  try {
    var result = callback();
    if (!result.status) result.status = "sucesso";
    return json_(result);
  } catch (err) {
    try {
      addSystemLog_("api_error", err.message, "api", "WebApp", "Erro");
    } catch (logErr) {
      // Evita mascarar o erro original.
    }
    return json_({
      status: "erro",
      message: err.message,
      version: VIVASSOL.VERSION,
      serverTime: new Date().toISOString()
    });
  }
}

function success_(action, data) {
  return {
    status: "sucesso",
    action: action,
    data: data,
    meta: getMeta_()
  };
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function withLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function isEmptyRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== "" && row[i] !== null) return false;
  }
  return true;
}

function serializeCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }
  return value;
}

function toNumber_(value) {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  if (value === "" || value === null || value === undefined) return 0;
  return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
}

function round2_(value) {
  return Math.round(value * 100) / 100;
}

function sumPagamentosPayload_(pagamentos) {
  var total = 0;
  for (var i = 0; i < pagamentos.length; i++) {
    if (String(pagamentos[i].status || "").toLowerCase() !== "estornado") {
      total += toNumber_(pagamentos[i].valor);
    }
  }
  return total;
}

function statusPagamentoFromValores_(total, paid) {
  total = toNumber_(total);
  paid = toNumber_(paid);
  if (paid <= 0) return "Nao pago";
  if (paid >= total && total > 0) return paid > total ? "Pago a mais" : "Pago";
  if (paid > 0 && paid <= total * 0.55) return "Sinal recebido";
  return "Parcial";
}

function makeId_(prefix) {
  return prefix + "_" + Utilities.getUuid().split("-")[0];
}

function prefixForTable_(table) {
  var map = {
    Usuarios: "usr",
    Clientes: "cli",
    Produtos: "pro",
    Insumos: "ins",
    Ficha_Tecnica: "fic",
    Vendas: "ven",
    Itens_Venda: "itv",
    Personalizacoes: "per",
    Producao: "prd",
    Estoque: "est",
    Movimentacoes_Estoque: "mov",
    Fornecedores: "for",
    Entradas_Fornecedor: "ent",
    Itens_Entrada_Fornecedor: "ief",
    Orcamentos: "orc",
    Itens_Orcamento: "ito",
    Financeiro: "fin",
    Pagamentos: "pag",
    Integracoes: "int",
    Agentes: "agt",
    Logs_Agentes: "loga",
    Logs_Sistema: "log",
    Aprovacoes: "apr",
    Fila_Sincronizacao: "sync",
    Backups: "bkp",
    Health_Check: "hlt"
  };
  return map[table] || "row";
}
