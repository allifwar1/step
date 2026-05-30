"use strict";

(() => {
  const STORAGE_KEY = "vivassol.erp.database.v1";
  const SESSION_KEY = "vivassol.erp.session.v1";
  const TRUST_KEY = "vivassol.erp.trusted-device.v1";

  const PASSWORD_HASHES = {
    allif: "da567b5f09f055a646df0e74c6014785930a8d207b22964868153f872b9bf9cf",
    karen: "e8026bda3ea2eedc7dc7bce9daa640f8cc0f33e335bd73d986a872b3ba789c71",
  };

  const PROJECT_CONFIG = {
    apiUrl: "https://script.google.com/macros/s/AKfycbx6cpndslxNfjCZon9mNj5iJSyjbRtcVQpj7wUefTt8HGTs-u7B9EdtRhNt3JO-LoU/exec",
    apiToken: "viva_d7d6e4bd30c27d36b3c77a8781d9879da9bf8792cede9bf3",
    spreadsheetId: "1NpGoMj03JFo5dCQ8Wk1LnwG6ZbegyXdN2DVjwS1EoMg",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1NpGoMj03JFo5dCQ8Wk1LnwG6ZbegyXdN2DVjwS1EoMg/edit",
    backupSpreadsheetUrl: "https://docs.google.com/spreadsheets/d/1VrLAGoT2Ob27eL_iaULVYTORWjS_iwcJleaVaVUST9Y/edit",
  };

  const MODULES = [
    { id: "dashboard", label: "Dashboard", title: "Painel inicial", icon: "▦" },
    { id: "vendas", label: "Vendas", title: "Vendas e nova venda", icon: "$" },
    { id: "clientes", label: "Clientes", title: "Clientes", icon: "@" },
    { id: "produtos", label: "Produtos", title: "Produtos finais", icon: "#" },
    { id: "insumos", label: "Insumos", title: "Insumos", icon: "+" },
    { id: "ficha", label: "Ficha tecnica", title: "Ficha tecnica e precificador", icon: "%" },
    { id: "estoque", label: "Estoque", title: "Estoque", icon: "=" },
    { id: "producao", label: "Producao", title: "Producao personalizada", icon: ">" },
    { id: "orcamentos", label: "Orcamentos", title: "Orcamentos", icon: "?" },
    { id: "fornecedores", label: "Fornecedores", title: "Fornecedores e entradas", icon: "&" },
    { id: "financeiro", label: "Financeiro", title: "Financeiro", icon: "R" },
    { id: "relatorios", label: "Relatorios", title: "Relatorios", icon: "*" },
    { id: "integracoes", label: "Integracoes", title: "Integracoes futuras", icon: "~" },
    { id: "agentes", label: "Agentes IA", title: "Agentes de IA futuros", icon: "IA" },
    { id: "usuarios", label: "Usuarios", title: "Usuarios e permissoes", icon: "U", adminOnly: true },
    { id: "configuracoes", label: "Configuracoes", title: "Configuracoes", icon: "." },
  ];

  const CORE_MOBILE = ["dashboard", "vendas", "clientes", "estoque", "financeiro"];
  const PRODUCTION_STATUSES = [
    "Pedido recebido",
    "Aguardando informacoes",
    "Arte pendente",
    "Arte enviada",
    "Arte aprovada",
    "Em producao",
    "Pronto",
    "Saiu para entrega",
    "Entregue",
    "Cancelado",
  ];
  const BUDGET_STATUSES = ["Criado", "Aguardando cliente", "Aprovado", "Convertido em venda", "Recusado", "Vencido"];
  const DELIVERY_STATUSES = ["Aguardando", "Em separacao", "Saiu para entrega", "Despachado", "Entregue", "Cancelado"];
  const PAYMENT_STATUSES = ["Pago", "Pendente", "Parcial", "Divergente", "Cancelado", "Estornado"];
  const SALE_CHANNELS = ["Loja local", "WhatsApp", "Instagram", "Shopee", "Mercado Livre", "TikTok Shop", "Site proprio", "Bling", "Tiny/Olist"];

  const state = {
    db: loadDatabase(),
    currentUser: null,
    view: "dashboard",
    editing: {},
    filters: {},
    dbConnection: {
      status: "offline",
      message: "Banco de dados desconectado",
      timer: null,
      checking: false,
    },
    sync: {
      initialPullDone: false,
      applyingRemote: false,
      pulling: false,
      pushing: false,
      pushTimer: null,
    },
  };

  const el = {
    loginScreen: document.getElementById("loginScreen"),
    appShell: document.getElementById("appShell"),
    loginForm: document.getElementById("loginForm"),
    loginUser: document.getElementById("loginUser"),
    loginPassword: document.getElementById("loginPassword"),
    trustedDevice: document.getElementById("trustedDevice"),
    loginMessage: document.getElementById("loginMessage"),
    mainNav: document.getElementById("mainNav"),
    mobileNav: document.getElementById("mobileNav"),
    content: document.getElementById("appContent"),
    viewTitle: document.getElementById("viewTitle"),
    viewEyebrow: document.getElementById("viewEyebrow"),
    userBadge: document.getElementById("userBadge"),
    syncStatus: document.getElementById("syncStatus"),
    sidebar: document.getElementById("sidebar"),
    modalRoot: document.getElementById("modalRoot"),
    toastRoot: document.getElementById("toastRoot"),
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyProjectConfig();
    document.body.dataset.theme = state.db.configuracoes.tema || "light";
    bindGlobalEvents();
    applyTrustedLogin();
  }

  function bindGlobalEvents() {
    el.loginForm.addEventListener("submit", handleLogin);
    document.getElementById("logoutButton").addEventListener("click", logout);
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);
    document.getElementById("menuToggle").addEventListener("click", () => el.sidebar.classList.toggle("open"));

    el.content.addEventListener("submit", handleSubmit);
    el.content.addEventListener("click", handleContentClick);
    el.content.addEventListener("input", handleContentInput);
    el.content.addEventListener("change", handleContentChange);
    el.modalRoot.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-modal], .modal-root")) closeModal();
    });
  }

  function applyProjectConfig() {
    const externalConfig = window.VIVASSOL_CONFIG && typeof window.VIVASSOL_CONFIG === "object" ? window.VIVASSOL_CONFIG : {};
    const config = { ...PROJECT_CONFIG, ...externalConfig };
    const keys = ["apiUrl", "apiToken", "spreadsheetId", "spreadsheetUrl", "backupSpreadsheetUrl"];
    let changed = false;
    keys.forEach((key) => {
      const value = String(config[key] || "").trim();
      if (value && state.db.configuracoes[key] !== value) {
        state.db.configuracoes[key] = value;
        changed = true;
      }
    });
    if (changed) saveDatabase({ skipRemotePush: true });
  }

  async function handleLogin(event) {
    event.preventDefault();
    el.loginMessage.textContent = "";
    const usuario = normalize(el.loginUser.value);
    const senha = el.loginPassword.value.trim();
    const passwordHash = await hashText(senha);
    const user = state.db.usuarios.find((item) => normalize(item.usuario) === usuario && item.status === "Ativo");

    if (!user || user.senha_hash !== passwordHash) {
      el.loginMessage.textContent = "Usuario ou senha invalidos.";
      return;
    }

    state.currentUser = user;
    persistSession(user.id, el.trustedDevice.checked);
    addLog("login", `Usuario ${user.usuario} entrou no sistema.`);
    renderApp();
  }

  function applyTrustedLogin() {
    const trusted = readJSON(TRUST_KEY, null);
    const session = readJSON(SESSION_KEY, null);
    const sessionInfo = trusted || session;
    if (sessionInfo?.userId) {
      const user = state.db.usuarios.find((item) => item.id === sessionInfo.userId && item.status === "Ativo");
      if (user) {
        state.currentUser = user;
        renderApp();
        return;
      }
    }
    el.loginUser.value = "";
    el.loginScreen.classList.remove("hidden");
    el.appShell.classList.add("hidden");
  }

  function persistSession(userId, trusted) {
    writeJSON(SESSION_KEY, { userId, at: new Date().toISOString() });
    if (trusted) writeJSON(TRUST_KEY, { userId, at: new Date().toISOString() });
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TRUST_KEY);
    state.currentUser = null;
    stopDatabaseMonitor();
    el.loginPassword.value = "";
    el.loginScreen.classList.remove("hidden");
    el.appShell.classList.add("hidden");
    el.sidebar.classList.remove("open");
  }

  function renderApp() {
    el.loginScreen.classList.add("hidden");
    el.appShell.classList.remove("hidden");
    el.userBadge.textContent = state.currentUser.nome;
    updateDatabaseStatus(state.db.configuracoes.apiUrl ? "checking" : "offline");
    renderNavigation();
    setView(state.view);
    syncFromSpreadsheetOnOpen();
    startDatabaseMonitor();
  }

  function renderNavigation() {
    const allowed = MODULES.filter((module) => canAccess(module.id));
    el.mainNav.innerHTML = allowed
      .map((module) => navButton(module))
      .join("");
    el.mobileNav.innerHTML = allowed
      .filter((module) => CORE_MOBILE.includes(module.id))
      .map((module) => navButton(module, true))
      .join("");
    [...el.mainNav.querySelectorAll("[data-view]"), ...el.mobileNav.querySelectorAll("[data-view]")].forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
        el.sidebar.classList.remove("open");
      });
    });
  }

  function navButton(module, mobile = false) {
    return `
      <button class="${mobile ? "" : "nav-button"} ${state.view === module.id ? "active" : ""}" type="button" data-view="${module.id}">
        <span class="nav-icon">${module.icon}</span>
        <span>${module.label}</span>
      </button>
    `;
  }

  function setView(view) {
    if (!canAccess(view)) view = "dashboard";
    state.view = view;
    state.editing = {};
    const module = MODULES.find((item) => item.id === view) || MODULES[0];
    el.viewTitle.textContent = module.title;
    el.viewEyebrow.textContent = module.label;
    renderNavigation();
    renderCurrentView();
    el.content.focus({ preventScroll: true });
  }

  function canAccess(moduleId) {
    const module = MODULES.find((item) => item.id === moduleId);
    if (!module || !state.currentUser) return false;
    if (module.adminOnly && state.currentUser.usuario !== "allif") return false;
    const permissions = normalizePermissions(state.currentUser.permissoes);
    return permissions.includes(moduleId);
  }

  function renderCurrentView(options = {}) {
    const focusState = options.preserveFocus ? captureFocusState() : null;
    const renderers = {
      dashboard: renderDashboard,
      vendas: renderVendas,
      clientes: renderClientes,
      produtos: renderProdutos,
      insumos: renderInsumos,
      ficha: renderFichaTecnica,
      estoque: renderEstoque,
      producao: renderProducao,
      orcamentos: renderOrcamentos,
      fornecedores: renderFornecedores,
      financeiro: renderFinanceiro,
      relatorios: renderRelatorios,
      integracoes: renderIntegracoes,
      agentes: renderAgentes,
      usuarios: renderUsuarios,
      configuracoes: renderConfiguracoes,
    };
    el.content.innerHTML = (renderers[state.view] || renderDashboard)();
    if (focusState) restoreFocusState(focusState);
  }

  function handleContentInput(event) {
    const field = event.target;
    if (field.matches("[data-filter]")) {
      state.filters[field.dataset.filter] = field.value;
      renderCurrentView({ preserveFocus: true });
    }
    if (field.matches("[data-price-live]")) {
      updateFichaPreview();
    }
  }

  function captureFocusState() {
    const active = document.activeElement;
    if (!active || !el.content.contains(active)) return null;
    const selector = focusSelector(active);
    if (!selector) return null;
    return {
      selector,
      value: "value" in active ? active.value : "",
      start: typeof active.selectionStart === "number" ? active.selectionStart : null,
      end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  function focusSelector(element) {
    if (element.id) return `#${cssEscape(element.id)}`;
    if (element.dataset.filter) return `[data-filter="${cssEscape(element.dataset.filter)}"]`;
    if (element.name) return `[name="${cssEscape(element.name)}"]`;
    return null;
  }

  function restoreFocusState(focusState) {
    const next = el.content.querySelector(focusState.selector);
    if (!next) return;
    next.focus({ preventScroll: true });
    if ("value" in next && next.value !== focusState.value) next.value = focusState.value;
    if (focusState.start !== null && typeof next.setSelectionRange === "function") {
      try {
        next.setSelectionRange(focusState.start, focusState.end);
      } catch {
        // Some input types do not support cursor restoration.
      }
    }
  }

  function handleContentChange(event) {
    const field = event.target;
    if (field.matches("[data-price-live]")) updateFichaPreview();
  }

  function handleContentClick(event) {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.edit) {
      state.editing[state.view] = button.dataset.edit;
      renderCurrentView();
      return;
    }

    if (button.dataset.cancelEdit) {
      state.editing[state.view] = null;
      renderCurrentView();
      return;
    }

    if (button.dataset.delete && button.dataset.table) {
      confirmDelete(button.dataset.table, button.dataset.delete);
      return;
    }

    if (button.dataset.nextProduction) {
      moveProduction(button.dataset.nextProduction);
      return;
    }

    if (button.dataset.convertBudget) {
      convertBudget(button.dataset.convertBudget);
      return;
    }

    if (button.dataset.syncPull) {
      syncPull();
      return;
    }

    if (button.dataset.syncPush) {
      confirmSyncPush();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const action = form.dataset.action;
    const data = Object.fromEntries(new FormData(form).entries());

    const handlers = {
      cliente: saveCliente,
      produto: saveProduto,
      insumo: saveInsumo,
      ficha: saveFichaTecnica,
      movimento: saveMovimentoEstoque,
      venda: saveVenda,
      orcamento: saveOrcamento,
      fornecedor: saveFornecedor,
      entrada: saveEntradaFornecedor,
      financeiro: saveFinanceiro,
      usuario: saveUsuario,
      configuracoes: saveConfiguracoes,
    };

    if (handlers[action]) {
      Promise.resolve(handlers[action](data, form)).catch((error) => {
        console.error(error);
        toast("Nao foi possivel concluir esta acao.", "danger");
      });
    }
  }

  function renderDashboard() {
    const today = dateISO();
    const localToday = state.db.vendas.filter((venda) => venda.data.startsWith(today) && venda.tipo === "Local");
    const ecommerceToday = state.db.vendas.filter((venda) => venda.data.startsWith(today) && venda.tipo === "Ecommerce");
    const stockValue = stockTotalValue();
    const stockQty = stockTotalQty();
    const lowStock = lowStockItems().slice(0, 5);

    return `
      <section class="view-grid">
        <div class="kpi-grid">
          ${kpi("Vendas locais hoje", money(sum(localToday, "total")), `${localToday.length} venda(s)`)}
          ${kpi("E-commerce hoje", money(sum(ecommerceToday, "total")), `${ecommerceToday.length} venda(s)`)}
          ${kpi("Valor em estoque", money(stockValue), `${stockQty.toLocaleString("pt-BR")} itens/unidades`)}
          ${kpi("Pedidos em producao", activeProductionCount(), "personalizados abertos")}
        </div>
        <div class="chart-grid">
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Historico de 7 dias</h3>
                <p>Faturamento diario somando vendas locais e internet.</p>
              </div>
            </div>
            ${barChart(salesByLastDays(7))}
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Historico de 30 dias</h3>
                <p>Resumo agrupado para acompanhar tendencia do mes.</p>
              </div>
            </div>
            ${barChart(salesByLastDays(30, 6))}
          </section>
        </div>
        <div class="two-col">
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Top 5 estoque baixo</h3>
                <p>Produtos ou insumos abaixo do minimo.</p>
              </div>
            </div>
            ${lowStock.length ? summaryList(lowStock.map((item) => [item.nome, `${item.quantidade} ${item.unidade || "un"}`])) : empty("Nenhum item abaixo do estoque minimo.")}
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Alertas rapidos</h3>
                <p>Pontos que merecem atencao hoje.</p>
              </div>
            </div>
            ${summaryList([
              ["Orcamentos aguardando", state.db.orcamentos.filter((item) => item.status === "Aguardando cliente").length],
              ["Contas a receber", money(sum(state.db.financeiro.filter((item) => item.status === "Pendente" && item.tipo === "Entrada"), "valor"))],
              ["Pedidos proximos do prazo", dueProductionCount()],
              ["Movimentacoes de estoque hoje", state.db.movimentacoesEstoque.filter((item) => item.data.startsWith(today)).length],
            ])}
          </section>
        </div>
      </section>
    `;
  }

  function renderClientes() {
    const editing = getEditing("clientes");
    const query = normalize(state.filters.clientes || "");
    const rows = state.db.clientes
      .filter((item) => [item.codigo, item.nome, item.telefone, item.origem].some((value) => normalize(value).includes(query)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return `
      <section class="two-col">
        <form class="form-panel form-grid" data-action="cliente">
          <div class="panel-header">
            <div>
              <h3>${editing ? "Editar cliente" : "Novo cliente"}</h3>
              <p>Cadastro completo com historico de vendas.</p>
            </div>
          </div>
          ${editing ? `<input type="hidden" name="id" value="${escapeHTML(editing.id)}">` : ""}
          <div class="field-row">
            ${input("codigo", "Codigo", editing?.codigo || nextCode("clientes"), "text", true)}
            ${input("nome", "Nome", editing?.nome || "", "text", true)}
          </div>
          <div class="field-row">
            ${input("telefone", "Telefone/WhatsApp", editing?.telefone || "")}
            ${input("aniversario", "Aniversario", editing?.aniversario || "", "date")}
          </div>
          ${input("endereco", "Endereco", editing?.endereco || "")}
          <div class="field-row">
            ${input("origem", "Origem", editing?.origem || "Local")}
            ${select("status", "Status", ["Ativo", "Inativo"], editing?.status || "Ativo")}
          </div>
          ${textarea("preferencias", "Preferencias", editing?.preferencias || "")}
          ${textarea("observacoes", "Observacoes", editing?.observacoes || "")}
          <div class="button-row">
            <button class="primary-button" type="submit"><span class="btn-icon">+</span>Salvar cliente</button>
            ${editing ? `<button class="ghost-button" type="button" data-cancel-edit="1">Cancelar</button>` : ""}
          </div>
        </form>
        <section>
          <div class="search-row">
            <input data-filter="clientes" value="${escapeHTML(state.filters.clientes || "")}" placeholder="Buscar cliente, telefone ou origem">
          </div>
          ${tablePanel(
            ["Codigo", "Cliente", "Telefone", "Compras", "Total", "Acoes"],
            rows.map((item) => {
              const vendas = state.db.vendas.filter((venda) => venda.cliente_id === item.id);
              return [
                item.codigo,
                item.nome,
                item.telefone || "-",
                vendas.length,
                money(sum(vendas, "total")),
                actions("clientes", item.id, item.codigo === "01"),
              ];
            })
          )}
        </section>
      </section>
    `;
  }

  function renderProdutos() {
    const editing = getEditing("produtosFinais");
    const rows = state.db.produtosFinais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return `
      <section class="two-col">
        <form class="form-panel form-grid" data-action="produto">
          <div class="panel-header">
            <div>
              <h3>${editing ? "Editar produto final" : "Novo produto final"}</h3>
              <p>Produtos personalizados que podem ter ficha tecnica.</p>
            </div>
          </div>
          ${editing ? `<input type="hidden" name="id" value="${escapeHTML(editing.id)}">` : ""}
          ${input("nome", "Nome do produto", editing?.nome || "", "text", true)}
          <div class="field-row">
            ${input("categoria", "Categoria", editing?.categoria || "Personalizados")}
            ${select("status", "Status", ["Ativo", "Inativo"], editing?.status || "Ativo")}
          </div>
          <div class="field-row three">
            ${input("preco_venda", "Preco de venda", editing?.preco_venda || "", "number", true, "0.01")}
            ${input("margem", "Margem desejada (%)", editing?.margem || "60", "number", false, "0.01")}
            ${input("estoque_minimo", "Estoque minimo", editing?.estoque_minimo || "0", "number", false, "1")}
          </div>
          ${textarea("observacoes", "Observacoes", editing?.observacoes || "")}
          <div class="button-row">
            <button class="primary-button" type="submit"><span class="btn-icon">+</span>Salvar produto</button>
            ${editing ? `<button class="ghost-button" type="button" data-cancel-edit="1">Cancelar</button>` : ""}
          </div>
        </form>
        ${tablePanel(
          ["Produto", "Categoria", "Custo", "Venda", "Margem", "Acoes"],
          rows.map((item) => [
            item.nome,
            item.categoria,
            money(item.custo_calculado),
            money(item.preco_venda),
            `${num(item.margem)}%`,
            actions("produtosFinais", item.id),
          ])
        )}
      </section>
    `;
  }

  function renderInsumos() {
    const editing = getEditing("insumos");
    const rows = state.db.insumos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return `
      <section class="two-col">
        <form class="form-panel form-grid" data-action="insumo">
          <div class="panel-header">
            <div>
              <h3>${editing ? "Editar insumo" : "Novo insumo"}</h3>
              <p>Materia-prima usada no estoque e precificador.</p>
            </div>
          </div>
          ${editing ? `<input type="hidden" name="id" value="${escapeHTML(editing.id)}">` : ""}
          ${input("nome", "Nome do insumo", editing?.nome || "", "text", true)}
          <div class="field-row">
            ${input("categoria", "Categoria", editing?.categoria || "Materia-prima")}
            ${input("unidade", "Unidade", editing?.unidade || "un")}
          </div>
          <div class="field-row three">
            ${input("custo_unitario", "Custo unitario", editing?.custo_unitario || "", "number", true, "0.0001")}
            ${input("quantidade", "Quantidade atual", editing?.quantidade || "0", "number", true, "0.0001")}
            ${input("estoque_minimo", "Estoque minimo", editing?.estoque_minimo || "0", "number", false, "0.0001")}
          </div>
          <div class="field-row">
            ${selectFrom("fornecedor_id", "Fornecedor principal", state.db.fornecedores, editing?.fornecedor_id || "", "Sem fornecedor")}
            ${select("status", "Status", ["Ativo", "Inativo"], editing?.status || "Ativo")}
          </div>
          <div class="button-row">
            <button class="primary-button" type="submit"><span class="btn-icon">+</span>Salvar insumo</button>
            ${editing ? `<button class="ghost-button" type="button" data-cancel-edit="1">Cancelar</button>` : ""}
          </div>
        </form>
        ${tablePanel(
          ["Insumo", "Un.", "Qtd", "Minimo", "Custo", "Acoes"],
          rows.map((item) => [
            item.nome,
            item.unidade,
            formatQty(item.quantidade),
            formatQty(item.estoque_minimo),
            money(item.custo_unitario),
            actions("insumos", item.id),
          ])
        )}
      </section>
    `;
  }

  function renderFichaTecnica() {
    const selectedProductId = state.filters.produtoFicha || state.db.produtosFinais[0]?.id || "";
    const selectedProduct = state.db.produtosFinais.find((item) => item.id === selectedProductId);
    const items = state.db.fichaTecnica.filter((item) => item.produto_id === selectedProductId);
    const cost = recipeCost(selectedProductId);
    const margem = selectedProduct ? num(selectedProduct.margem) : 60;
    const sugestao = cost.total * (1 + margem / 100);

    return `
      <section class="view-grid">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h3>Produto no precificador</h3>
              <p>Monte a ficha tecnica e calcule o preco sugerido.</p>
            </div>
          </div>
          ${selectFrom("produto_ficha", "Produto final", state.db.produtosFinais, selectedProductId, "", "data-price-live data-ficha-product")}
        </section>
        <section class="two-col">
          <form class="form-panel form-grid" data-action="ficha">
            <input type="hidden" name="produto_id" value="${escapeHTML(selectedProductId)}">
            <div class="panel-header">
              <div>
                <h3>Adicionar insumo</h3>
                <p>Cada item entra na baixa automatica quando vender.</p>
              </div>
            </div>
            ${selectFrom("insumo_id", "Insumo", state.db.insumos, "")}
            ${input("quantidade", "Quantidade usada por produto", "", "number", true, "0.0001")}
            <button class="primary-button" type="submit"><span class="btn-icon">+</span>Adicionar na ficha</button>
          </form>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Resumo do preco</h3>
                <p id="fichaPreview">Custo ${money(cost.total)} | Preco sugerido ${money(sugestao)}</p>
              </div>
            </div>
            ${items.length ? summaryList(items.map((entry) => {
              const insumo = findById("insumos", entry.insumo_id);
              return [
                `${insumo?.nome || "Insumo removido"} x ${formatQty(entry.quantidade)}`,
                money(num(entry.quantidade) * num(insumo?.custo_unitario)),
              ];
            })) : empty("Ainda nao ha insumos na ficha deste produto.")}
          </section>
        </section>
        ${tablePanel(
          ["Insumo", "Quantidade", "Custo unit.", "Subtotal", "Acoes"],
          items.map((entry) => {
            const insumo = findById("insumos", entry.insumo_id);
            return [
              insumo?.nome || "Insumo removido",
              formatQty(entry.quantidade),
              money(insumo?.custo_unitario || 0),
              money(num(entry.quantidade) * num(insumo?.custo_unitario)),
              actions("fichaTecnica", entry.id),
            ];
          })
        )}
      </section>
    `;
  }

  function renderEstoque() {
    const rows = state.db.movimentacoesEstoque.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);
    return `
      <section class="view-grid">
        <div class="kpi-grid">
          ${kpi("Valor dos insumos", money(sum(state.db.insumos.map((item) => ({ total: num(item.quantidade) * num(item.custo_unitario) })), "total")), "materia-prima")}
          ${kpi("Quantidade em insumos", formatQty(sum(state.db.insumos, "quantidade")), "unidades medidas")}
          ${kpi("Itens abaixo do minimo", lowStockItems().length, "precisam de atencao")}
          ${kpi("Movimentos hoje", state.db.movimentacoesEstoque.filter((item) => item.data.startsWith(dateISO())).length, "entradas e saidas")}
        </div>
        <section class="two-col">
          <form class="form-panel form-grid" data-action="movimento">
            <div class="panel-header">
              <div>
                <h3>Ajuste manual</h3>
                <p>Entrada, saida ou correcao de estoque.</p>
              </div>
            </div>
            ${select("item_tipo", "Tipo", ["Insumo", "Produto final"], "Insumo")}
            ${selectFrom("item_id", "Item", [...state.db.insumos, ...state.db.produtosFinais], "")}
            <div class="field-row">
              ${select("tipo", "Movimento", ["Entrada", "Saida", "Ajuste"], "Entrada")}
              ${input("quantidade", "Quantidade", "", "number", true, "0.0001")}
            </div>
            ${input("motivo", "Motivo", "Ajuste manual")}
            <button class="primary-button" type="submit"><span class="btn-icon">=</span>Salvar movimento</button>
          </form>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Estoque baixo</h3>
                <p>Lista completa dos itens abaixo do minimo.</p>
              </div>
            </div>
            ${lowStockItems().length ? summaryList(lowStockItems().map((item) => [item.nome, `${formatQty(item.quantidade)} de minimo ${formatQty(item.estoque_minimo)}`])) : empty("Estoque dentro do minimo cadastrado.")}
          </section>
        </section>
        ${tablePanel(
          ["Data", "Tipo", "Item", "Qtd", "Motivo", "Usuario"],
          rows.map((item) => [
            dateTimeBR(item.data),
            item.tipo,
            item.item_nome,
            formatQty(item.quantidade),
            item.motivo,
            findById("usuarios", item.usuario_id)?.nome || "-",
          ])
        )}
      </section>
    `;
  }

  function renderVendas() {
    const rows = state.db.vendas.slice().sort((a, b) => b.data.localeCompare(a.data));
    return `
      <section class="view-grid">
        <form class="form-panel form-grid" data-action="venda">
          <div class="panel-header">
            <div>
              <h3>Nova venda</h3>
              <p>Ao salvar, o sistema baixa os insumos da ficha tecnica automaticamente.</p>
            </div>
          </div>
          <div class="field-row three">
            ${selectFrom("cliente_id", "Cliente", state.db.clientes, state.db.clientes.find((item) => item.codigo === "01")?.id || "", "", "", "nome")}
            ${select("tipo", "Tipo", ["Local", "Ecommerce"], "Local")}
            ${select("canal", "Canal", SALE_CHANNELS, "Loja local")}
          </div>
          <div class="field-row three">
            ${selectFrom("produto_id", "Produto", state.db.produtosFinais, "")}
            ${input("quantidade", "Quantidade", "1", "number", true, "1")}
            ${input("preco_unitario", "Preco unitario", "", "number", false, "0.01")}
          </div>
          <div class="field-row three">
            ${input("desconto", "Desconto", "0", "number", false, "0.01")}
            ${input("entrega_valor", "Entrega/Frete", "0", "number", false, "0.01")}
            ${input("prazo", "Prazo combinado", "", "date")}
          </div>
          <div class="field-row three">
            ${select("pagamento", "Forma de pagamento", ["Pix", "Dinheiro", "Cartao", "Plataforma", "Pendente"], "Pix")}
            ${select("pagamento_status", "Status pagamento", PAYMENT_STATUSES, "Pago")}
            ${select("entrega_status", "Status entrega", DELIVERY_STATUSES, "Aguardando")}
          </div>
          <div class="field-row three">
            ${input("nome_personalizado", "Nome personalizado", "")}
            ${input("tema", "Tema", "")}
            ${input("cor", "Cor", "")}
          </div>
          <div class="field-row three">
            ${input("frase", "Frase", "")}
            ${input("tamanho", "Tamanho/modelo", "")}
            ${select("status_arte", "Status da arte", ["Nao precisa", "Pendente", "Enviada", "Aprovada"], "Pendente")}
          </div>
          ${textarea("observacoes", "Observacoes da venda", "")}
          <button class="primary-button" type="submit"><span class="btn-icon">$</span>Salvar venda</button>
        </form>
        ${tablePanel(
          ["Data", "Cliente", "Tipo", "Canal", "Total", "Pagamento", "Producao", "Entrega"],
          rows.map((venda) => [
            dateTimeBR(venda.data),
            findById("clientes", venda.cliente_id)?.nome || "-",
            venda.tipo,
            venda.canal,
            money(venda.total),
            statusTag(venda.pagamento_status),
            statusTag(venda.producao_status),
            statusTag(venda.entrega_status),
          ])
        )}
      </section>
    `;
  }

  function renderProducao() {
    const groups = ["Pedido recebido", "Arte pendente", "Em producao", "Pronto"];
    return `
      <section class="view-grid">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h3>Fila de producao</h3>
              <p>Pedidos personalizados criados a partir das vendas.</p>
            </div>
          </div>
          <div class="board">
            ${groups.map((status) => productionColumn(status)).join("")}
          </div>
        </section>
      </section>
    `;
  }

  function renderOrcamentos() {
    const rows = state.db.orcamentos.slice().sort((a, b) => b.data.localeCompare(a.data));
    return `
      <section class="view-grid">
        <form class="form-panel form-grid" data-action="orcamento">
          <div class="panel-header">
            <div>
              <h3>Novo orcamento</h3>
              <p>Quando aprovado, pode virar venda com um clique.</p>
            </div>
          </div>
          <div class="field-row three">
            ${selectFrom("cliente_id", "Cliente", state.db.clientes, "")}
            ${selectFrom("produto_id", "Produto", state.db.produtosFinais, "")}
            ${input("quantidade", "Quantidade", "1", "number", true, "1")}
          </div>
          <div class="field-row three">
            ${input("valor", "Valor proposto", "", "number", true, "0.01")}
            ${input("validade", "Validade", dateISO(7), "date")}
            ${select("status", "Status", BUDGET_STATUSES, "Aguardando cliente")}
          </div>
          ${textarea("observacoes", "Observacoes", "")}
          <button class="primary-button" type="submit"><span class="btn-icon">?</span>Salvar orcamento</button>
        </form>
        ${tablePanel(
          ["Data", "Cliente", "Produto", "Valor", "Status", "Acoes"],
          rows.map((item) => [
            dateBR(item.data),
            findById("clientes", item.cliente_id)?.nome || "-",
            findById("produtosFinais", item.produto_id)?.nome || "-",
            money(item.valor),
            statusTag(item.status),
            item.status === "Aprovado" ? `<button class="mini-button" type="button" data-convert-budget="${item.id}">Virar venda</button>` : "-",
          ])
        )}
      </section>
    `;
  }

  function renderFornecedores() {
    return `
      <section class="view-grid">
        <section class="two-col">
          <form class="form-panel form-grid" data-action="fornecedor">
            <div class="panel-header">
              <div>
                <h3>Novo fornecedor</h3>
                <p>Cadastro completo para compras e entradas.</p>
              </div>
            </div>
            ${input("nome", "Nome/Razao social", "", "text", true)}
            <div class="field-row">
              ${input("documento", "CNPJ/CPF", "")}
              ${input("telefone", "Telefone/WhatsApp", "")}
            </div>
            <div class="field-row">
              ${input("email", "Email", "","email")}
              ${select("status", "Status", ["Ativo", "Inativo"], "Ativo")}
            </div>
            ${input("endereco", "Endereco", "")}
            ${textarea("produtos_fornecidos", "Produtos fornecidos", "")}
            ${textarea("observacoes", "Observacoes", "")}
            <button class="primary-button" type="submit"><span class="btn-icon">&</span>Salvar fornecedor</button>
          </form>
          <form class="form-panel form-grid" data-action="entrada">
            <div class="panel-header">
              <div>
                <h3>Entrada de fornecedor</h3>
                <p>Entrada manual hoje, nota fiscal inteligente no futuro.</p>
              </div>
            </div>
            ${selectFrom("fornecedor_id", "Fornecedor", state.db.fornecedores, "")}
            ${selectFrom("insumo_id", "Insumo recebido", state.db.insumos, "")}
            <div class="field-row three">
              ${input("quantidade", "Quantidade", "", "number", true, "0.0001")}
              ${input("custo_unitario", "Custo unitario", "", "number", true, "0.0001")}
              ${input("numero_documento", "Nota/documento", "")}
            </div>
            ${textarea("observacoes", "Observacoes", "")}
            <button class="primary-button" type="submit"><span class="btn-icon">+</span>Lancar entrada</button>
          </form>
        </section>
        ${tablePanel(
          ["Fornecedor", "Documento", "Telefone", "Produtos", "Status"],
          state.db.fornecedores.map((item) => [item.nome, item.documento || "-", item.telefone || "-", item.produtos_fornecidos || "-", statusTag(item.status)])
        )}
      </section>
    `;
  }

  function renderFinanceiro() {
    const entradas = state.db.financeiro.filter((item) => item.tipo === "Entrada");
    const saidas = state.db.financeiro.filter((item) => item.tipo === "Saida");
    const saldo = sum(entradas.filter((item) => item.status === "Pago"), "valor") - sum(saidas.filter((item) => item.status === "Pago"), "valor");
    return `
      <section class="view-grid">
        <div class="kpi-grid">
          ${kpi("Entradas pagas", money(sum(entradas.filter((item) => item.status === "Pago"), "valor")), `${entradas.length} lancamento(s)`)}
          ${kpi("Saidas pagas", money(sum(saidas.filter((item) => item.status === "Pago"), "valor")), `${saidas.length} lancamento(s)`)}
          ${kpi("Saldo do caixa", money(saldo), "base nos lancamentos pagos")}
          ${kpi("A receber", money(sum(entradas.filter((item) => item.status === "Pendente"), "valor")), "pendente")}
        </div>
        <section class="two-col">
          <form class="form-panel form-grid" data-action="financeiro">
            <div class="panel-header">
              <div>
                <h3>Novo lancamento</h3>
                <p>Fluxo de caixa simples para a primeira versao.</p>
              </div>
            </div>
            <div class="field-row three">
              ${select("tipo", "Tipo", ["Entrada", "Saida"], "Saida")}
              ${input("data", "Data", dateISO(), "date")}
              ${input("valor", "Valor", "", "number", true, "0.01")}
            </div>
            <div class="field-row">
              ${input("descricao", "Descricao", "", "text", true)}
              ${input("categoria", "Categoria", "Geral")}
            </div>
            <div class="field-row">
              ${select("status", "Status", ["Pago", "Pendente", "Cancelado"], "Pago")}
              ${select("forma", "Forma", ["Pix", "Dinheiro", "Cartao", "Plataforma", "Boleto"], "Pix")}
            </div>
            <button class="primary-button" type="submit"><span class="btn-icon">R</span>Salvar lancamento</button>
          </form>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h3>Resumo DRE simplificado</h3>
                <p>Primeira leitura gerencial do resultado.</p>
              </div>
            </div>
            ${summaryList([
              ["Receita bruta", money(sum(entradas, "valor"))],
              ["Despesas", money(sum(saidas, "valor"))],
              ["Resultado estimado", money(sum(entradas, "valor") - sum(saidas, "valor"))],
              ["Curva ABC", "Disponivel em Relatorios"],
            ])}
          </section>
        </section>
        ${tablePanel(
          ["Data", "Tipo", "Descricao", "Categoria", "Valor", "Status"],
          state.db.financeiro.slice().sort((a, b) => b.data.localeCompare(a.data)).map((item) => [
            dateBR(item.data),
            item.tipo,
            item.descricao,
            item.categoria,
            money(item.valor),
            statusTag(item.status),
          ])
        )}
      </section>
    `;
  }

  function renderRelatorios() {
    const productSales = abcProducts();
    const channelSales = groupSalesBy("canal");
    const clientSales = state.db.clientes
      .map((cliente) => ({ nome: cliente.nome, total: sum(state.db.vendas.filter((venda) => venda.cliente_id === cliente.id), "total") }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return `
      <section class="view-grid">
        <div class="three-col">
          <section class="panel">
            <div class="panel-header"><h3>Curva ABC inicial</h3></div>
            ${summaryList(productSales.map((item) => [item.nome, `${money(item.total)} | Classe ${item.classe}`]))}
          </section>
          <section class="panel">
            <div class="panel-header"><h3>Vendas por canal</h3></div>
            ${summaryList(channelSales.map((item) => [item.nome, money(item.total)]))}
          </section>
          <section class="panel">
            <div class="panel-header"><h3>Clientes que mais compram</h3></div>
            ${summaryList(clientSales.map((item) => [item.nome, money(item.total)]))}
          </section>
        </div>
      </section>
    `;
  }

  function renderIntegracoes() {
    return futurePanel("Integracoes preparadas", [
      ["Bling", "Sincronizar produtos, pedidos e notas fiscais futuramente."],
      ["Tiny/Olist", "Importar vendas de ecommerce e conferir financeiro."],
      ["Marketplaces", "Shopee, Mercado Livre, TikTok Shop e site proprio."],
      ["WooCommerce", "Preparado para conectar o site quando ele estiver pronto."],
    ]);
  }

  function renderAgentes() {
    return futurePanel("Central futura de agentes", [
      ["Agente Vendas", "Interpretar WhatsApp e sugerir vendas."],
      ["Agente Estoque", "Baixar, conferir e alertar estoque baixo."],
      ["Agente Financeiro", "Enviar resumo diario, DRE e cobrancas."],
      ["Agente Auditor", "Registrar conversas, aprovacoes e acoes sensiveis."],
    ]);
  }

  function renderUsuarios() {
    if (state.currentUser.usuario !== "allif") return empty("Somente allif acessa este modulo.");
    return `
      <section class="two-col">
        <form class="form-panel form-grid" data-action="usuario">
          <div class="panel-header">
            <div>
              <h3>Novo usuario</h3>
              <p>Permissoes por modulo para funcionarios futuros.</p>
            </div>
          </div>
          <div class="field-row">
            ${input("usuario", "Usuario", "", "text", true)}
            ${input("nome", "Nome", "", "text", true)}
          </div>
          <div class="field-row">
            ${input("senha", "Senha inicial", "", "password", true)}
            ${select("status", "Status", ["Ativo", "Inativo"], "Ativo")}
          </div>
          <div>
            <p class="section-title">Permissoes</p>
            <div class="permission-grid">
              ${MODULES.filter((module) => module.id !== "usuarios").map((module) => `
                <label>
                  <input type="checkbox" name="permissoes" value="${module.id}" checked>
                  <span>${module.label}</span>
                </label>
              `).join("")}
            </div>
          </div>
          <button class="primary-button" type="submit"><span class="btn-icon">U</span>Criar usuario</button>
        </form>
        ${tablePanel(
          ["Usuario", "Nome", "Permissoes", "Status"],
          state.db.usuarios.map((item) => [item.usuario, item.nome, item.permissoes.length, statusTag(item.status)])
        )}
      </section>
    `;
  }

  function renderConfiguracoes() {
    return `
      <section class="two-col">
        <form class="form-panel form-grid" data-action="configuracoes">
          <div class="panel-header">
            <div>
              <h3>Google Planilhas</h3>
              <p>Cole aqui a URL do Apps Script publicado como aplicativo web.</p>
            </div>
          </div>
          ${input("apiUrl", "URL da API Apps Script", state.db.configuracoes.apiUrl || "", "url")}
          ${input("apiToken", "TOKEN da API", state.db.configuracoes.apiToken || "", "password")}
          ${input("spreadsheetId", "ID da planilha", state.db.configuracoes.spreadsheetId || PROJECT_CONFIG.spreadsheetId)}
          ${input("spreadsheetUrl", "Link da planilha principal", state.db.configuracoes.spreadsheetUrl || "", "url")}
          ${input("backupSpreadsheetUrl", "Link da planilha espelho", state.db.configuracoes.backupSpreadsheetUrl || "", "url")}
          <button class="primary-button" type="submit"><span class="btn-icon">.</span>Salvar configuracoes</button>
          <div class="button-row">
            <button class="secondary-button" type="button" data-sync-push="1">Enviar dados locais para planilha</button>
            <button class="ghost-button" type="button" data-sync-pull="1">Puxar dados da planilha</button>
            ${state.db.configuracoes.spreadsheetUrl ? `<a class="ghost-button" href="${escapeHTML(state.db.configuracoes.spreadsheetUrl)}" target="_blank" rel="noreferrer">Abrir principal</a>` : ""}
            ${state.db.configuracoes.backupSpreadsheetUrl ? `<a class="ghost-button" href="${escapeHTML(state.db.configuracoes.backupSpreadsheetUrl)}" target="_blank" rel="noreferrer">Abrir espelho</a>` : ""}
          </div>
        </form>
        <section class="panel">
          <div class="panel-header">
            <div>
              <h3>Estado atual</h3>
              <p>Primeira versao pronta para testar localmente.</p>
            </div>
          </div>
          ${summaryList([
            ["Modo de dados", state.db.configuracoes.apiUrl ? "Google Planilhas configurado" : "Local neste navegador"],
            ["Planilha", state.db.configuracoes.spreadsheetId || "Nao configurada"],
            ["TOKEN", state.db.configuracoes.apiToken ? "Configurado" : "Nao configurado"],
            ["Ultima alteracao", dateTimeBR(state.db.configuracoes.updatedAt || new Date().toISOString())],
            ["Logs do sistema", state.db.logsSistema.length],
          ])}
        </section>
      </section>
    `;
  }

  function saveCliente(data) {
    const record = {
      id: data.id || makeId("cli"),
      codigo: data.codigo || nextCode("clientes"),
      nome: data.nome.trim(),
      telefone: data.telefone.trim(),
      endereco: data.endereco.trim(),
      origem: data.origem.trim(),
      preferencias: data.preferencias.trim(),
      observacoes: data.observacoes.trim(),
      aniversario: data.aniversario,
      status: data.status,
      criado_em: data.id ? findById("clientes", data.id)?.criado_em : new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    upsert("clientes", record);
    addLog("cliente", `Cliente ${record.nome} salvo.`);
    toast("Cliente salvo.");
    renderCurrentView();
  }

  function saveProduto(data) {
    const existing = data.id ? findById("produtosFinais", data.id) : null;
    const record = {
      id: data.id || makeId("pro"),
      nome: data.nome.trim(),
      categoria: data.categoria.trim(),
      preco_venda: num(data.preco_venda),
      custo_calculado: existing?.custo_calculado || 0,
      margem: num(data.margem),
      estoque_minimo: num(data.estoque_minimo),
      estoque_pronto: existing?.estoque_pronto || 0,
      status: data.status,
      observacoes: data.observacoes.trim(),
      atualizado_em: new Date().toISOString(),
    };
    upsert("produtosFinais", record);
    addLog("produto", `Produto ${record.nome} salvo.`);
    toast("Produto salvo.");
    renderCurrentView();
  }

  function saveInsumo(data) {
    const existing = data.id ? findById("insumos", data.id) : null;
    const record = {
      id: data.id || makeId("ins"),
      nome: data.nome.trim(),
      categoria: data.categoria.trim(),
      unidade: data.unidade.trim() || "un",
      custo_unitario: num(data.custo_unitario),
      quantidade: num(data.quantidade),
      estoque_minimo: num(data.estoque_minimo),
      fornecedor_id: data.fornecedor_id,
      status: data.status,
      atualizado_em: new Date().toISOString(),
    };
    upsert("insumos", record);
    if (!existing) recordStockMove("Entrada", "Insumo", record.id, record.quantidade, "Cadastro inicial", null);
    addLog("insumo", `Insumo ${record.nome} salvo.`);
    toast("Insumo salvo.");
    renderCurrentView();
  }

  function saveFichaTecnica(data) {
    if (!data.produto_id || !data.insumo_id) {
      toast("Escolha produto e insumo.", "warn");
      return;
    }
    const record = {
      id: makeId("fic"),
      produto_id: data.produto_id,
      insumo_id: data.insumo_id,
      quantidade: num(data.quantidade),
      atualizado_em: new Date().toISOString(),
    };
    state.db.fichaTecnica.push(record);
    recalcProductCost(data.produto_id);
    saveDatabase();
    toast("Insumo adicionado na ficha.");
    renderCurrentView();
  }

  function saveMovimentoEstoque(data) {
    const table = data.item_tipo === "Insumo" ? "insumos" : "produtosFinais";
    const item = findById(table, data.item_id);
    if (!item) {
      toast("Item nao encontrado.", "warn");
      return;
    }
    const amount = num(data.quantidade);
    if (data.item_tipo === "Insumo") {
      item.quantidade = data.tipo === "Saida" ? num(item.quantidade) - amount : data.tipo === "Ajuste" ? amount : num(item.quantidade) + amount;
    } else {
      item.estoque_pronto = data.tipo === "Saida" ? num(item.estoque_pronto) - amount : data.tipo === "Ajuste" ? amount : num(item.estoque_pronto) + amount;
    }
    recordStockMove(data.tipo, data.item_tipo, item.id, amount, data.motivo, null);
    saveDatabase();
    toast("Estoque atualizado.");
    renderCurrentView();
  }

  function saveVenda(data) {
    const product = findById("produtosFinais", data.produto_id);
    if (!product) {
      toast("Escolha um produto.", "warn");
      return;
    }
    const qty = Math.max(1, num(data.quantidade));
    const unit = num(data.preco_unitario) || num(product.preco_venda);
    const subtotal = qty * unit;
    const total = subtotal - num(data.desconto) + num(data.entrega_valor);
    const shortages = checkRecipeShortage(product.id, qty);

    if (shortages.length && !window.confirm(`Estoque insuficiente para: ${shortages.join(", ")}. Deseja salvar mesmo assim?`)) {
      return;
    }

    const venda = {
      id: makeId("ven"),
      data: new Date().toISOString(),
      cliente_id: data.cliente_id,
      tipo: data.tipo,
      canal: data.canal,
      total,
      desconto: num(data.desconto),
      entrega_valor: num(data.entrega_valor),
      pagamento: data.pagamento,
      pagamento_status: data.pagamento_status,
      entrega_status: data.entrega_status,
      producao_status: "Pedido recebido",
      usuario_id: state.currentUser.id,
      origem: "Interface",
      observacoes: data.observacoes.trim(),
    };
    const item = {
      id: makeId("itv"),
      venda_id: venda.id,
      produto_id: product.id,
      quantidade: qty,
      preco_unitario: unit,
      subtotal,
    };
    const personalizacao = {
      id: makeId("per"),
      item_venda_id: item.id,
      nome_personalizado: data.nome_personalizado.trim(),
      tema: data.tema.trim(),
      cor: data.cor.trim(),
      frase: data.frase.trim(),
      tamanho: data.tamanho.trim(),
      modelo: data.modelo.trim(),
      prazo: data.prazo,
      observacoes: data.observacoes.trim(),
      status_arte: data.status_arte,
    };
    const producao = {
      id: makeId("prd"),
      venda_id: venda.id,
      item_venda_id: item.id,
      status: "Pedido recebido",
      prazo: data.prazo,
      observacoes: data.observacoes.trim(),
      atualizado_em: new Date().toISOString(),
    };
    state.db.vendas.push(venda);
    state.db.itensVenda.push(item);
    state.db.personalizacoes.push(personalizacao);
    state.db.producao.push(producao);
    decreaseRecipeStock(product.id, qty, venda.id);
    createFinanceFromSale(venda);
    addLog("venda", `Venda ${venda.id} criada para ${findById("clientes", venda.cliente_id)?.nome || "cliente"}.`);
    saveDatabase();
    toast("Venda salva e estoque baixado.");
    renderCurrentView();
  }

  function saveOrcamento(data) {
    const record = {
      id: makeId("orc"),
      data: new Date().toISOString(),
      cliente_id: data.cliente_id,
      produto_id: data.produto_id,
      quantidade: num(data.quantidade),
      valor: num(data.valor),
      validade: data.validade,
      status: data.status,
      observacoes: data.observacoes.trim(),
      usuario_id: state.currentUser.id,
    };
    state.db.orcamentos.push(record);
    saveDatabase();
    toast("Orcamento salvo.");
    renderCurrentView();
  }

  function saveFornecedor(data) {
    const record = {
      id: makeId("for"),
      nome: data.nome.trim(),
      documento: data.documento.trim(),
      telefone: data.telefone.trim(),
      email: data.email.trim(),
      endereco: data.endereco.trim(),
      produtos_fornecidos: data.produtos_fornecidos.trim(),
      observacoes: data.observacoes.trim(),
      status: data.status,
      criado_em: new Date().toISOString(),
    };
    state.db.fornecedores.push(record);
    saveDatabase();
    toast("Fornecedor salvo.");
    renderCurrentView();
  }

  function saveEntradaFornecedor(data) {
    const fornecedor = findById("fornecedores", data.fornecedor_id);
    const insumo = findById("insumos", data.insumo_id);
    if (!fornecedor || !insumo) {
      toast("Escolha fornecedor e insumo.", "warn");
      return;
    }
    const qty = num(data.quantidade);
    const cost = num(data.custo_unitario);
    insumo.quantidade = num(insumo.quantidade) + qty;
    if (cost > 0) insumo.custo_unitario = cost;
    const entrada = {
      id: makeId("ent"),
      data: new Date().toISOString(),
      fornecedor_id: fornecedor.id,
      insumo_id: insumo.id,
      quantidade: qty,
      custo_unitario: cost,
      total: qty * cost,
      numero_documento: data.numero_documento.trim(),
      observacoes: data.observacoes.trim(),
      usuario_id: state.currentUser.id,
    };
    state.db.entradasFornecedor.push(entrada);
    recordStockMove("Entrada", "Insumo", insumo.id, qty, `Entrada fornecedor ${fornecedor.nome}`, entrada.id);
    state.db.financeiro.push({
      id: makeId("fin"),
      tipo: "Saida",
      origem_id: entrada.id,
      data: dateISO(),
      descricao: `Compra fornecedor ${fornecedor.nome}`,
      categoria: "Compra de insumos",
      valor: entrada.total,
      status: "Pendente",
      forma: "Pix",
    });
    saveDatabase();
    toast("Entrada lancada.");
    renderCurrentView();
  }

  function saveFinanceiro(data) {
    state.db.financeiro.push({
      id: makeId("fin"),
      tipo: data.tipo,
      origem_id: "",
      data: data.data,
      descricao: data.descricao.trim(),
      categoria: data.categoria.trim(),
      valor: num(data.valor),
      status: data.status,
      forma: data.forma,
    });
    saveDatabase();
    toast("Lancamento salvo.");
    renderCurrentView();
  }

  async function saveUsuario(data, form) {
    if (state.currentUser.usuario !== "allif") return;
    const usuario = normalize(data.usuario);
    if (state.db.usuarios.some((item) => normalize(item.usuario) === usuario)) {
      toast("Ja existe um usuario com esse login.", "warn");
      return;
    }
    const permissions = [...form.querySelectorAll("input[name='permissoes']:checked")].map((item) => item.value);
    state.db.usuarios.push({
      id: makeId("usr"),
      usuario,
      nome: data.nome.trim(),
      senha_hash: await hashText(data.senha),
      perfil: "Funcionario",
      permissoes: permissions,
      status: data.status,
      criado_em: new Date().toISOString(),
    });
    saveDatabase();
    toast("Usuario criado.");
    renderCurrentView();
  }

  async function saveConfiguracoes(data) {
    state.db.configuracoes.apiUrl = data.apiUrl.trim();
    state.db.configuracoes.apiToken = data.apiToken.trim();
    state.db.configuracoes.spreadsheetId = data.spreadsheetId.trim();
    state.db.configuracoes.spreadsheetUrl = data.spreadsheetUrl.trim();
    state.db.configuracoes.backupSpreadsheetUrl = data.backupSpreadsheetUrl.trim();
    state.db.configuracoes.updatedAt = new Date().toISOString();
    saveDatabase({ skipRemotePush: true });
    toast("Configuracoes salvas.");
    state.sync.initialPullDone = false;
    renderApp();
    await syncPull({ silent: true, keepView: true });
  }

  function convertBudget(id) {
    const budget = findById("orcamentos", id);
    if (!budget) return;
    budget.status = "Convertido em venda";
    const product = findById("produtosFinais", budget.produto_id);
    const venda = {
      id: makeId("ven"),
      data: new Date().toISOString(),
      cliente_id: budget.cliente_id,
      tipo: "Local",
      canal: "WhatsApp",
      total: budget.valor,
      desconto: 0,
      entrega_valor: 0,
      pagamento: "Pendente",
      pagamento_status: "Pendente",
      entrega_status: "Aguardando",
      producao_status: "Pedido recebido",
      usuario_id: state.currentUser.id,
      origem: "Orcamento",
      observacoes: budget.observacoes,
    };
    const item = {
      id: makeId("itv"),
      venda_id: venda.id,
      produto_id: budget.produto_id,
      quantidade: budget.quantidade,
      preco_unitario: budget.valor / Math.max(1, budget.quantidade),
      subtotal: budget.valor,
    };
    state.db.vendas.push(venda);
    state.db.itensVenda.push(item);
    state.db.producao.push({
      id: makeId("prd"),
      venda_id: venda.id,
      item_venda_id: item.id,
      status: "Pedido recebido",
      prazo: "",
      observacoes: budget.observacoes,
      atualizado_em: new Date().toISOString(),
    });
    if (product) decreaseRecipeStock(product.id, budget.quantidade, venda.id);
    createFinanceFromSale(venda);
    saveDatabase();
    toast("Orcamento convertido em venda.");
    renderCurrentView();
  }

  function moveProduction(id) {
    const task = findById("producao", id);
    if (!task) return;
    const currentIndex = PRODUCTION_STATUSES.indexOf(task.status);
    const nextStatus = PRODUCTION_STATUSES[Math.min(currentIndex + 1, PRODUCTION_STATUSES.length - 1)];
    task.status = nextStatus;
    task.atualizado_em = new Date().toISOString();
    const sale = findById("vendas", task.venda_id);
    if (sale) sale.producao_status = nextStatus;
    saveDatabase();
    toast("Status de producao atualizado.");
    renderCurrentView();
  }

  function confirmDelete(table, id) {
    const protectedTables = ["usuarios", "vendas", "itensVenda", "financeiro"];
    if (protectedTables.includes(table)) {
      toast("Este registro e sensivel. A exclusao fica para a etapa com aprovacao.", "warn");
      return;
    }
    openModal(`
      <h3>Excluir registro?</h3>
      <p>Esta acao remove o item desta primeira versao local.</p>
      <div class="button-row">
        <button class="danger-button" type="button" data-confirm-delete="${table}:${id}">Excluir</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    `);
    const confirmButton = el.modalRoot.querySelector("[data-confirm-delete]");
    confirmButton.addEventListener("click", () => {
      state.db[table] = state.db[table].filter((item) => item.id !== id);
      saveDatabase();
      closeModal();
      toast("Registro excluido.");
      renderCurrentView();
    });
  }

  function confirmSyncPush() {
    openModal(`
      <h3>Enviar dados locais?</h3>
      <p>Esta acao substitui a planilha pelos dados que estao neste navegador agora.</p>
      <div class="button-row">
        <button class="danger-button" type="button" data-confirm-sync-push="1">Enviar para a planilha</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    `);
    const confirmButton = el.modalRoot.querySelector("[data-confirm-sync-push]");
    confirmButton.addEventListener("click", async () => {
      closeModal();
      await syncPush();
    });
  }

  async function fetchJSONWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const payload = await response.json();
      return { response, payload };
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Tempo limite ao conversar com o banco de dados.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function refreshCurrentUserFromDatabase() {
    if (!state.currentUser?.id) return;
    const freshUser = state.db.usuarios.find((item) => item.id === state.currentUser.id && item.status === "Ativo");
    if (freshUser) state.currentUser = freshUser;
  }

  async function syncPush(options = {}) {
    const silent = Boolean(options.silent);
    const url = state.db.configuracoes.apiUrl;
    if (state.sync.pushing || state.sync.pulling) {
      if (!silent) toast("Sincronizacao em andamento. Tente novamente em alguns segundos.", "warn");
      return;
    }
    if (!url) {
      updateDatabaseStatus("offline", "Banco de dados desconectado");
      if (!silent) toast("Configure a URL do Apps Script primeiro.", "warn");
      return;
    }
    if (!state.db.configuracoes.apiToken) {
      if (!silent) toast("Configure o TOKEN da API primeiro.", "warn");
      return;
    }
    state.sync.pushing = true;
    try {
      updateDatabaseStatus("checking", silent ? "Sincronizando com o banco..." : "Enviando para o banco...");
      const { response, payload } = await fetchJSONWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "replaceAll", token: state.db.configuracoes.apiToken, payload: state.db }),
      }, 20000);
      if (!response.ok || payload.status !== "sucesso") throw new Error(payload.message || "Falha ao salvar na planilha.");
      updateDatabaseStatus("online");
      if (!silent) toast("Dados enviados para a planilha.");
    } catch (error) {
      updateDatabaseStatus("offline");
      if (!silent) toast("Nao foi possivel enviar para a planilha.", "danger");
      console.error(error);
    } finally {
      state.sync.pushing = false;
    }
  }

  async function syncPull(options = {}) {
    const silent = Boolean(options.silent);
    const keepView = Boolean(options.keepView);
    const background = Boolean(options.background);
    const url = state.db.configuracoes.apiUrl;
    if (state.sync.pulling || state.sync.pushing) {
      if (!silent) toast("Sincronizacao em andamento. Tente novamente em alguns segundos.", "warn");
      return;
    }
    if (background && hasActiveFormInput()) return;
    if (!url) {
      updateDatabaseStatus("offline", "Banco de dados desconectado");
      if (!silent) toast("Configure a URL do Apps Script primeiro.", "warn");
      return;
    }
    if (!state.db.configuracoes.apiToken) {
      if (!silent) toast("Configure o TOKEN da API primeiro.", "warn");
      return;
    }
    state.sync.pulling = true;
    try {
      if (!background) updateDatabaseStatus("checking", silent ? "Atualizando dados do banco..." : "Puxando do banco...");
      const { response, payload } = await fetchJSONWithTimeout(`${url}?action=readAll&token=${encodeURIComponent(state.db.configuracoes.apiToken)}`, {}, 20000);
      if (!response.ok || payload.status !== "sucesso") throw new Error(payload.message || "Falha");
      state.sync.applyingRemote = true;
      state.db = { ...state.db, ...normalizeRemoteDatabase(payload.data), configuracoes: state.db.configuracoes };
      saveDatabase({ skipRemotePush: true });
      state.sync.applyingRemote = false;
      state.sync.initialPullDone = true;
      refreshCurrentUserFromDatabase();
      updateDatabaseStatus("online");
      if (!silent) toast("Dados puxados da planilha.");
      if (keepView) renderCurrentView({ preserveFocus: background });
      else renderApp();
    } catch (error) {
      state.sync.applyingRemote = false;
      updateDatabaseStatus("offline");
      if (!silent) toast("Nao foi possivel puxar a planilha.", "danger");
      console.error(error);
    } finally {
      state.sync.pulling = false;
    }
  }

  function syncFromSpreadsheetOnOpen() {
    if (state.sync.initialPullDone || !state.currentUser) return;
    if (!state.db.configuracoes.apiUrl || !state.db.configuracoes.apiToken) return;
    syncPull({ silent: true, keepView: true });
  }

  function hasActiveFormInput() {
    if (el.modalRoot.innerHTML.trim()) return true;
    const active = document.activeElement;
    if (!active || !el.content.contains(active) || active.matches("[data-filter]")) return false;
    return Boolean(active.closest("form"));
  }

  function queueRemotePush() {
    if (state.sync.applyingRemote || !state.currentUser) return;
    if (!state.sync.initialPullDone) return;
    if (!state.db.configuracoes.apiUrl || !state.db.configuracoes.apiToken) return;
    window.clearTimeout(state.sync.pushTimer);
    state.sync.pushTimer = window.setTimeout(() => {
      if (state.sync.pulling || state.sync.pushing) {
        queueRemotePush();
        return;
      }
      syncPush({ silent: true });
    }, 900);
  }

  function startDatabaseMonitor() {
    stopDatabaseMonitor();
    if (!state.db.configuracoes.apiUrl) {
      updateDatabaseStatus("offline", "Banco de dados desconectado");
      return;
    }
    checkDatabaseConnection();
    state.dbConnection.timer = window.setInterval(checkDatabaseConnection, 30000);
  }

  function stopDatabaseMonitor() {
    if (state.dbConnection.timer) {
      window.clearInterval(state.dbConnection.timer);
      state.dbConnection.timer = null;
    }
  }

  async function checkDatabaseConnection() {
    const url = state.db.configuracoes.apiUrl;
    if (!url || !state.currentUser) {
      updateDatabaseStatus("offline", "Banco de dados desconectado");
      return;
    }
    if (state.dbConnection.checking || state.sync.pulling || state.sync.pushing) return;
    state.dbConnection.checking = true;
    updateDatabaseStatus("checking", "Verificando banco de dados...");
    try {
      const { response, payload } = await fetchJSONWithTimeout(`${url}?action=ping&ts=${Date.now()}`, { cache: "no-store" }, 12000);
      if (!response.ok || payload.status !== "sucesso") throw new Error(payload.message || "Banco sem resposta.");
      updateDatabaseStatus("online");
      if (state.sync.initialPullDone) syncPull({ silent: true, keepView: true, background: true });
    } catch (error) {
      updateDatabaseStatus("offline");
      console.error(error);
    } finally {
      state.dbConnection.checking = false;
    }
  }

  function updateDatabaseStatus(status, message = "") {
    const labels = {
      online: "Banco de dados conectado e online",
      offline: "Banco de dados desconectado",
      checking: "Verificando banco de dados...",
    };
    const classes = {
      online: "ok",
      offline: "danger",
      checking: "warn checking",
    };
    state.dbConnection.status = status;
    state.dbConnection.message = message || labels[status] || labels.offline;
    el.syncStatus.className = `status-pill ${classes[status] || classes.offline}`;
    el.syncStatus.title = state.dbConnection.message;
    el.syncStatus.innerHTML = `<span class="status-dot"></span>${escapeHTML(state.dbConnection.message)}`;
  }

  function normalizeRemoteDatabase(data) {
    if (!data || typeof data !== "object") return {};
    const produtos = asArray(data.Produtos || data.Produtos_Finais || data.produtosFinais, state.db.produtosFinais).map(normalizeRemoteProduct);
    const vendas = asArray(data.Vendas || data.vendas, state.db.vendas).map(normalizeRemoteSale);
    const itensVenda = asArray(data.Itens_Venda || data.itensVenda, state.db.itensVenda).map(normalizeRemoteSaleItem);
    return {
      usuarios: asArray(data.Usuarios || data.usuarios, state.db.usuarios).map(normalizeRemoteUser),
      clientes: asArray(data.Clientes || data.clientes, state.db.clientes),
      fornecedores: asArray(data.Fornecedores || data.fornecedores, state.db.fornecedores),
      insumos: asArray(data.Insumos || data.insumos, state.db.insumos),
      produtosFinais: produtos,
      fichaTecnica: asArray(data.Ficha_Tecnica || data.fichaTecnica, state.db.fichaTecnica),
      vendas,
      itensVenda,
      personalizacoes: asArray(data.Personalizacoes || data.personalizacoes, state.db.personalizacoes),
      producao: asArray(data.Producao || data.producao, state.db.producao),
      orcamentos: asArray(data.Orcamentos || data.orcamentos, state.db.orcamentos),
      entradasFornecedor: asArray(data.Entradas_Fornecedor || data.entradasFornecedor, state.db.entradasFornecedor),
      movimentacoesEstoque: asArray(data.Movimentacoes_Estoque || data.movimentacoesEstoque, state.db.movimentacoesEstoque),
      financeiro: asArray(data.Financeiro || data.financeiro, state.db.financeiro),
      pagamentos: asArray(data.Pagamentos || data.pagamentos, state.db.pagamentos || []),
      logsSistema: asArray(data.Logs_Sistema || data.logsSistema, state.db.logsSistema),
      logsAgentes: asArray(data.Logs_Agentes || data.logsAgentes, state.db.logsAgentes),
      aprovacoes: asArray(data.Aprovacoes || data.aprovacoes, state.db.aprovacoes),
      integracoes: asArray(data.Integracoes || data.integracoes, state.db.integracoes),
      agentes: asArray(data.Agentes || data.agentes, state.db.agentes),
      backups: asArray(data.Backups || data.backups, state.db.backups || []),
      healthCheck: asArray(data.Health_Check || data.healthCheck, state.db.healthCheck || []),
      estoque: asArray(data.Estoque || data.estoque, state.db.estoque || []),
    };
  }

  function asArray(value, fallback = []) {
    return Array.isArray(value) ? value : fallback;
  }

  function normalizeRemoteUser(user) {
    return {
      ...user,
      usuario: normalize(user.usuario),
      nome: user.nome || user.usuario || "Usuario",
      senha_hash: user.senha_hash || PASSWORD_HASHES[normalize(user.usuario)] || "",
      permissoes: normalizePermissions(user.permissoes),
      status: user.status || "Ativo",
    };
  }

  function normalizePermissions(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      return value
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  function normalizeRemoteProduct(product) {
    return {
      ...product,
      preco_sugerido: num(product.preco_sugerido) || num(product.preco_venda),
      preco_venda: num(product.preco_venda),
      custo_calculado: num(product.custo_calculado),
      margem: num(product.margem),
      estoque_minimo: num(product.estoque_minimo),
      estoque_pronto: num(product.estoque_pronto),
      modo_estoque: product.modo_estoque || "Sob demanda",
      status: product.status || "Ativo",
    };
  }

  function normalizeRemoteSale(venda) {
    const total = num(venda.valor_total ?? venda.total);
    const paid = num(venda.valor_pago);
    return {
      ...venda,
      total,
      valor_total: total,
      valor_pago: paid,
      valor_pendente: num(venda.valor_pendente) || Math.max(0, total - paid),
      pagamento: venda.forma_pagamento_principal || venda.pagamento || "",
      pagamento_status: venda.status_pagamento || venda.pagamento_status || "Pendente",
      producao_status: venda.status_pedido || venda.producao_status || "Pedido recebido",
      entrega_status: venda.entrega_status || "Aguardando",
      entrega_valor: num(venda.entrega_valor),
      desconto: num(venda.desconto),
    };
  }

  function normalizeRemoteSaleItem(item) {
    return {
      ...item,
      quantidade: num(item.quantidade),
      preco_unitario: num(item.preco_unitario),
      subtotal: num(item.subtotal),
      desconto_item: num(item.desconto_item),
    };
  }

  function decreaseRecipeStock(productId, qty, reference) {
    const recipe = state.db.fichaTecnica.filter((item) => item.produto_id === productId);
    recipe.forEach((entry) => {
      const insumo = findById("insumos", entry.insumo_id);
      if (!insumo) return;
      const amount = num(entry.quantidade) * qty;
      insumo.quantidade = num(insumo.quantidade) - amount;
      recordStockMove("Saida", "Insumo", insumo.id, amount, "Baixa automatica por venda", reference);
    });
  }

  function checkRecipeShortage(productId, qty) {
    return state.db.fichaTecnica
      .filter((item) => item.produto_id === productId)
      .map((entry) => {
        const insumo = findById("insumos", entry.insumo_id);
        const required = num(entry.quantidade) * qty;
        return insumo && num(insumo.quantidade) < required ? `${insumo.nome} (${formatQty(required - num(insumo.quantidade))} faltando)` : null;
      })
      .filter(Boolean);
  }

  function recordStockMove(tipo, itemTipo, itemId, quantidade, motivo, referencia) {
    const table = itemTipo === "Insumo" ? "insumos" : "produtosFinais";
    const item = findById(table, itemId);
    state.db.movimentacoesEstoque.push({
      id: makeId("mov"),
      data: new Date().toISOString(),
      tipo,
      item_tipo: itemTipo,
      item_id: itemId,
      item_nome: item?.nome || "Item",
      quantidade: num(quantidade),
      motivo,
      referencia: referencia || "",
      usuario_id: state.currentUser?.id || "system",
    });
  }

  function createFinanceFromSale(venda) {
    state.db.financeiro.push({
      id: makeId("fin"),
      tipo: "Entrada",
      origem_id: venda.id,
      data: dateISO(),
      descricao: `Venda ${venda.id}`,
      categoria: venda.tipo === "Ecommerce" ? "Venda ecommerce" : "Venda local",
      valor: venda.total,
      status: venda.pagamento_status === "Pago" ? "Pago" : "Pendente",
      forma: venda.pagamento,
    });
  }

  function recalcProductCost(productId) {
    const product = findById("produtosFinais", productId);
    if (!product) return;
    const cost = recipeCost(productId);
    product.custo_calculado = cost.total;
    if (!num(product.preco_venda)) product.preco_venda = cost.total * (1 + num(product.margem) / 100);
  }

  function recipeCost(productId) {
    const insumos = state.db.fichaTecnica.filter((entry) => entry.produto_id === productId);
    const total = insumos.reduce((acc, entry) => {
      const insumo = findById("insumos", entry.insumo_id);
      return acc + num(entry.quantidade) * num(insumo?.custo_unitario);
    }, 0);
    return { total };
  }

  function updateFichaPreview() {
    const selectProduct = document.querySelector("[data-ficha-product]");
    if (!selectProduct) return;
    state.filters.produtoFicha = selectProduct.value;
    renderCurrentView({ preserveFocus: true });
  }

  function productionColumn(status) {
    const tasks = state.db.producao.filter((item) => item.status === status);
    return `
      <div class="board-column">
        <h3>${status}</h3>
        ${tasks.length ? tasks.map((task) => {
          const venda = findById("vendas", task.venda_id);
          const item = findById("itensVenda", task.item_venda_id);
          const produto = findById("produtosFinais", item?.produto_id);
          const cliente = findById("clientes", venda?.cliente_id);
          return `
            <div class="task-card">
              <strong>${produto?.nome || "Produto"}</strong>
              <p>${cliente?.nome || "Cliente"} ${task.prazo ? `| prazo ${dateBR(task.prazo)}` : ""}</p>
              <button class="mini-button" type="button" data-next-production="${task.id}">Avancar</button>
            </div>
          `;
        }).join("") : `<p class="empty-state">Sem pedidos.</p>`}
      </div>
    `;
  }

  function futurePanel(title, items) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>${title}</h3>
            <p>Modulo planejado na arquitetura, sem automatizacao real nesta primeira etapa.</p>
          </div>
        </div>
        ${summaryList(items)}
      </section>
    `;
  }

  function stockTotalValue() {
    if (state.db.estoque?.length) {
      return state.db.estoque.reduce((acc, item) => {
        const source = item.item_tipo === "Insumo" ? findById("insumos", item.item_id) : findById("produtosFinais", item.item_id);
        const unitCost = item.item_tipo === "Insumo" ? num(source?.custo_unitario) : num(source?.custo_calculado);
        return acc + (num(item.quantidade_total ?? item.quantidade_disponivel) * unitCost);
      }, 0);
    }
    const insumos = sum(state.db.insumos.map((item) => ({ total: num(item.quantidade) * num(item.custo_unitario) })), "total");
    const products = sum(state.db.produtosFinais.map((item) => ({ total: num(item.estoque_pronto) * num(item.custo_calculado) })), "total");
    return insumos + products;
  }

  function stockTotalQty() {
    if (state.db.estoque?.length) return sum(state.db.estoque, "quantidade_total");
    return sum(state.db.insumos, "quantidade") + sum(state.db.produtosFinais, "estoque_pronto");
  }

  function lowStockItems() {
    if (state.db.estoque?.length) {
      return state.db.estoque
        .filter((item) => num(item.estoque_minimo) > 0 && num(item.quantidade_disponivel) <= num(item.estoque_minimo))
        .map((item) => ({ nome: item.item_nome, tipo: item.item_tipo, quantidade: item.quantidade_disponivel, unidade: item.unidade }));
    }
    const insumos = state.db.insumos
      .filter((item) => num(item.estoque_minimo) > 0 && num(item.quantidade) <= num(item.estoque_minimo))
      .map((item) => ({ ...item, tipo: "Insumo" }));
    const products = state.db.produtosFinais
      .filter((item) => num(item.estoque_minimo) > 0 && num(item.estoque_pronto) <= num(item.estoque_minimo))
      .map((item) => ({ ...item, tipo: "Produto", quantidade: item.estoque_pronto, unidade: "un" }));
    return [...insumos, ...products].sort((a, b) => num(a.quantidade) - num(b.quantidade));
  }

  function salesByLastDays(days, bucket = 1) {
    const result = [];
    for (let i = days - 1; i >= 0; i -= bucket) {
      const bucketDays = [];
      for (let j = 0; j < bucket && i - j >= 0; j += 1) bucketDays.push(dateISO(-(i - j)));
      const total = state.db.vendas
        .filter((venda) => bucketDays.some((day) => venda.data.startsWith(day)))
        .reduce((acc, venda) => acc + num(venda.total), 0);
      result.push({ label: bucket === 1 ? dateBR(bucketDays[0]).slice(0, 5) : `${dateBR(bucketDays[0]).slice(0, 5)}-${dateBR(bucketDays[bucketDays.length - 1]).slice(0, 5)}`, total });
    }
    return result;
  }

  function activeProductionCount() {
    return state.db.producao.filter((item) => !["Entregue", "Cancelado"].includes(item.status)).length;
  }

  function dueProductionCount() {
    const limit = dateISO(2);
    return state.db.producao.filter((item) => item.prazo && item.prazo <= limit && !["Entregue", "Cancelado"].includes(item.status)).length;
  }

  function abcProducts() {
    const totals = state.db.produtosFinais.map((product) => {
      const total = state.db.itensVenda
        .filter((item) => item.produto_id === product.id)
        .reduce((acc, item) => acc + num(item.subtotal), 0);
      return { nome: product.nome, total };
    }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
    const grand = totals.reduce((acc, item) => acc + item.total, 0);
    let running = 0;
    return totals.map((item) => {
      running += item.total;
      const pct = grand ? running / grand : 0;
      return { ...item, classe: pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C" };
    });
  }

  function groupSalesBy(field) {
    const map = new Map();
    state.db.vendas.forEach((venda) => {
      const key = venda[field] || "Sem informacao";
      map.set(key, (map.get(key) || 0) + num(venda.total));
    });
    return [...map.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }

  function kpi(label, value, detail) {
    return `<section class="kpi"><span>${label}</span><strong>${value}</strong><small>${detail}</small></section>`;
  }

  function barChart(data) {
    const max = Math.max(1, ...data.map((item) => item.total));
    return `<div class="bar-chart">
      ${data.map((item) => `
        <div class="bar-row">
          <span>${item.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (item.total / max) * 100)}%"></div></div>
          <strong>${money(item.total)}</strong>
        </div>
      `).join("")}
    </div>`;
  }

  function tablePanel(headers, rows) {
    if (!rows.length) return empty("Nenhum registro encontrado.");
    return `
      <section class="table-panel">
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>${row.map((cell, index) => `<td data-label="${headers[index]}">${cell}</td>`).join("")}</tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function summaryList(items) {
    if (!items.length) return empty("Sem informacoes por enquanto.");
    return `<div class="summary-list">
      ${items.map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}
    </div>`;
  }

  function empty(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function input(name, labelText, value = "", type = "text", required = false, step = "", extra = "") {
    return `
      <label>
        ${labelText}
        <input name="${name}" type="${type}" value="${escapeHTML(value)}" ${required ? "required" : ""} ${step ? `step="${step}"` : ""} ${extra}>
      </label>
    `;
  }

  function textarea(name, labelText, value = "") {
    return `
      <label>
        ${labelText}
        <textarea name="${name}">${escapeHTML(value)}</textarea>
      </label>
    `;
  }

  function select(name, labelText, options, selected = "", extra = "") {
    return `
      <label>
        ${labelText}
        <select name="${name}" ${extra}>
          ${options.map((option) => `<option value="${escapeHTML(option)}" ${option === selected ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function selectFrom(name, labelText, rows, selected = "", emptyLabel = "", extra = "", textField = "nome") {
    return `
      <label>
        ${labelText}
        <select name="${name}" ${extra}>
          ${emptyLabel ? `<option value="">${emptyLabel}</option>` : ""}
          ${rows.map((row) => `<option value="${escapeHTML(row.id)}" ${row.id === selected ? "selected" : ""}>${escapeHTML(row[textField] || row.nome || row.id)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function actions(table, id, protectedItem = false) {
    return `
      <div class="action-cell">
        <button class="mini-button" type="button" data-edit="${id}">Editar</button>
        ${protectedItem ? "" : `<button class="mini-button" type="button" data-table="${table}" data-delete="${id}">Excluir</button>`}
      </div>
    `;
  }

  function statusTag(value) {
    const danger = ["Cancelado", "Estornado", "Divergente", "Vencido"].includes(value);
    const ok = ["Pago", "Entregue", "Pronto", "Aprovado", "Ativo"].includes(value);
    const warn = ["Pendente", "Parcial", "Aguardando", "Aguardando cliente", "Arte pendente"].includes(value);
    return `<span class="tag ${danger ? "danger" : ok ? "ok" : warn ? "warn" : ""}">${escapeHTML(value || "-")}</span>`;
  }

  function getEditing(table) {
    const id = state.editing[state.view];
    return id ? findById(table, id) : null;
  }

  function findById(table, id) {
    return state.db[table]?.find((item) => item.id === id);
  }

  function upsert(table, record) {
    const index = state.db[table].findIndex((item) => item.id === record.id);
    if (index >= 0) state.db[table][index] = record;
    else state.db[table].push(record);
    saveDatabase();
  }

  function addLog(tipo, descricao) {
    state.db.logsSistema.push({
      id: makeId("log"),
      data: new Date().toISOString(),
      tipo,
      descricao,
      usuario_id: state.currentUser?.id || "system",
    });
    saveDatabase();
  }

  function openModal(html) {
    el.modalRoot.innerHTML = `<section class="modal">${html}</section>`;
  }

  function closeModal() {
    el.modalRoot.innerHTML = "";
  }

  function toast(message, type = "ok") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    el.toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 3600);
  }

  function toggleTheme() {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = next;
    state.db.configuracoes.tema = next;
    saveDatabase();
  }

  function saveDatabase(options = {}) {
    state.db.configuracoes.updatedAt = new Date().toISOString();
    writeJSON(STORAGE_KEY, state.db);
    if (!options.skipRemotePush) queueRemotePush();
  }

  function loadDatabase() {
    const fresh = seedDatabase();
    const existing = readJSON(STORAGE_KEY, null);
    const database = sanitizeDatabase(existing ? mergeDatabase(fresh, existing) : fresh, fresh);
    writeJSON(STORAGE_KEY, database);
    return database;
  }

  function mergeDatabase(base, existing) {
    return { ...base, ...existing, configuracoes: { ...base.configuracoes, ...existing.configuracoes } };
  }

  function sanitizeDatabase(database, fallback) {
    const arrayKeys = [
      "usuarios", "clientes", "fornecedores", "insumos", "produtosFinais", "fichaTecnica", "vendas", "itensVenda",
      "personalizacoes", "producao", "orcamentos", "estoque", "entradasFornecedor", "movimentacoesEstoque",
      "financeiro", "comissoes", "pagamentos", "backups", "healthCheck", "logsSistema", "logsAgentes",
      "aprovacoes", "integracoes", "agentes",
    ];
    arrayKeys.forEach((key) => {
      database[key] = asArray(database[key], fallback[key] || []);
    });
    database.usuarios = database.usuarios.map(normalizeRemoteUser);
    database.configuracoes = { ...fallback.configuracoes, ...(database.configuracoes || {}) };
    return database;
  }

  function seedDatabase() {
    const allPerms = MODULES.map((module) => module.id);
    const karenPerms = allPerms.filter((item) => item !== "usuarios");
    const clientes = [
      {
        id: "cli_01",
        codigo: "01",
        nome: "Cliente a vista",
        telefone: "",
        endereco: "",
        origem: "Venda rapida",
        preferencias: "",
        observacoes: "Cliente coringa para venda rapida.",
        aniversario: "",
        status: "Ativo",
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: "cli_02",
        codigo: "02",
        nome: "Maria exemplo",
        telefone: "(00) 90000-0000",
        endereco: "Centro",
        origem: "WhatsApp",
        preferencias: "Produtos de bebe",
        observacoes: "Cadastro exemplo para testar historico.",
        aniversario: "",
        status: "Ativo",
        criado_em: dateISO(-6),
        atualizado_em: dateISO(-6),
      },
    ];
    const fornecedores = [
      {
        id: "for_01",
        nome: "Fornecedor exemplo",
        documento: "",
        telefone: "",
        email: "",
        endereco: "",
        produtos_fornecidos: "Canecas, caixas e blanks",
        observacoes: "Registro inicial de exemplo.",
        status: "Ativo",
        criado_em: dateISO(-10),
      },
    ];
    const insumos = [
      { id: "ins_01", nome: "Caneca branca", categoria: "Sublimacao", unidade: "un", custo_unitario: 8.5, quantidade: 22, estoque_minimo: 10, fornecedor_id: "for_01", status: "Ativo" },
      { id: "ins_02", nome: "Caixa para caneca", categoria: "Embalagem", unidade: "un", custo_unitario: 1.6, quantidade: 30, estoque_minimo: 15, fornecedor_id: "for_01", status: "Ativo" },
      { id: "ins_03", nome: "Papel sublimatico", categoria: "Sublimacao", unidade: "folha", custo_unitario: 0.9, quantidade: 45, estoque_minimo: 20, fornecedor_id: "for_01", status: "Ativo" },
      { id: "ins_04", nome: "Body liso bebe", categoria: "Vestuario", unidade: "un", custo_unitario: 18, quantidade: 12, estoque_minimo: 8, fornecedor_id: "for_01", status: "Ativo" },
      { id: "ins_05", nome: "Manta lisa", categoria: "Vestuario", unidade: "un", custo_unitario: 25, quantidade: 6, estoque_minimo: 5, fornecedor_id: "for_01", status: "Ativo" },
    ];
    const produtosFinais = [
      { id: "pro_01", nome: "Caneca personalizada", categoria: "Canecas", preco_venda: 35, custo_calculado: 11, margem: 70, estoque_minimo: 0, estoque_pronto: 0, status: "Ativo", observacoes: "" },
      { id: "pro_02", nome: "Body de bebe personalizado", categoria: "Bebe", preco_venda: 49.9, custo_calculado: 18, margem: 70, estoque_minimo: 0, estoque_pronto: 0, status: "Ativo", observacoes: "" },
      { id: "pro_03", nome: "Manta personalizada", categoria: "Bebe", preco_venda: 79.9, custo_calculado: 25, margem: 70, estoque_minimo: 0, estoque_pronto: 0, status: "Ativo", observacoes: "" },
    ];
    const fichaTecnica = [
      { id: "fic_01", produto_id: "pro_01", insumo_id: "ins_01", quantidade: 1 },
      { id: "fic_02", produto_id: "pro_01", insumo_id: "ins_02", quantidade: 1 },
      { id: "fic_03", produto_id: "pro_01", insumo_id: "ins_03", quantidade: 1 },
      { id: "fic_04", produto_id: "pro_02", insumo_id: "ins_04", quantidade: 1 },
      { id: "fic_05", produto_id: "pro_03", insumo_id: "ins_05", quantidade: 1 },
    ];
    const vendas = [
      { id: "ven_01", data: `${dateISO(-2)}T10:30:00.000Z`, cliente_id: "cli_02", tipo: "Local", canal: "WhatsApp", total: 35, desconto: 0, entrega_valor: 0, pagamento: "Pix", pagamento_status: "Pago", entrega_status: "Entregue", producao_status: "Entregue", usuario_id: "usr_allif", origem: "Exemplo", observacoes: "" },
      { id: "ven_02", data: `${dateISO(-1)}T13:20:00.000Z`, cliente_id: "cli_01", tipo: "Ecommerce", canal: "Shopee", total: 79.9, desconto: 0, entrega_valor: 0, pagamento: "Plataforma", pagamento_status: "Pago", entrega_status: "Despachado", producao_status: "Pronto", usuario_id: "usr_karen", origem: "Exemplo", observacoes: "" },
    ];
    return {
      configuracoes: {
        apiUrl: PROJECT_CONFIG.apiUrl,
        apiToken: PROJECT_CONFIG.apiToken,
        spreadsheetId: PROJECT_CONFIG.spreadsheetId,
        spreadsheetUrl: PROJECT_CONFIG.spreadsheetUrl,
        backupSpreadsheetUrl: PROJECT_CONFIG.backupSpreadsheetUrl,
        tema: "light",
        updatedAt: new Date().toISOString(),
      },
      usuarios: [
        { id: "usr_allif", usuario: "allif", nome: "Allif", senha_hash: PASSWORD_HASHES.allif, perfil: "Administrador", permissoes: allPerms, status: "Ativo", criado_em: new Date().toISOString() },
        { id: "usr_karen", usuario: "karen", nome: "Karen", senha_hash: PASSWORD_HASHES.karen, perfil: "Operacional", permissoes: karenPerms, status: "Ativo", criado_em: new Date().toISOString() },
      ],
      clientes,
      fornecedores,
      insumos,
      produtosFinais,
      fichaTecnica,
      vendas,
      itensVenda: [
        { id: "itv_01", venda_id: "ven_01", produto_id: "pro_01", quantidade: 1, preco_unitario: 35, subtotal: 35 },
        { id: "itv_02", venda_id: "ven_02", produto_id: "pro_03", quantidade: 1, preco_unitario: 79.9, subtotal: 79.9 },
      ],
      personalizacoes: [
        { id: "per_01", item_venda_id: "itv_01", nome_personalizado: "Miguel", tema: "Girassol", cor: "Amarelo", frase: "", tamanho: "", modelo: "", prazo: dateISO(-1), observacoes: "", status_arte: "Aprovada" },
      ],
      producao: [
        { id: "prd_01", venda_id: "ven_01", item_venda_id: "itv_01", status: "Entregue", prazo: dateISO(-1), observacoes: "", atualizado_em: dateISO(-1) },
        { id: "prd_02", venda_id: "ven_02", item_venda_id: "itv_02", status: "Pronto", prazo: dateISO(1), observacoes: "", atualizado_em: dateISO(-1) },
      ],
      orcamentos: [
        { id: "orc_01", data: `${dateISO()}T09:00:00.000Z`, cliente_id: "cli_02", produto_id: "pro_02", quantidade: 2, valor: 99.8, validade: dateISO(5), status: "Aguardando cliente", observacoes: "Exemplo de orcamento.", usuario_id: "usr_allif" },
      ],
      estoque: [],
      entradasFornecedor: [],
      movimentacoesEstoque: [],
      financeiro: [
        { id: "fin_01", tipo: "Entrada", origem_id: "ven_01", data: dateISO(-2), descricao: "Venda exemplo local", categoria: "Venda local", valor: 35, status: "Pago", forma: "Pix" },
        { id: "fin_02", tipo: "Entrada", origem_id: "ven_02", data: dateISO(-1), descricao: "Venda exemplo ecommerce", categoria: "Venda ecommerce", valor: 79.9, status: "Pago", forma: "Plataforma" },
        { id: "fin_03", tipo: "Saida", origem_id: "", data: dateISO(-1), descricao: "Compra de insumos exemplo", categoria: "Compra de insumos", valor: 60, status: "Pago", forma: "Pix" },
      ],
      comissoes: [],
      pagamentos: [],
      backups: [],
      healthCheck: [],
      logsSistema: [],
      logsAgentes: [],
      aprovacoes: [],
      integracoes: [],
      agentes: [],
    };
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function nextCode(table) {
    const codes = state.db[table].map((item) => Number(item.codigo)).filter(Number.isFinite);
    return String((Math.max(0, ...codes) + 1)).padStart(2, "0");
  }

  function num(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (!value) return 0;
    return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
  }

  function sum(rows, field) {
    return rows.reduce((acc, item) => acc + num(item[field]), 0);
  }

  function money(value) {
    return num(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatQty(value) {
    return num(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  }

  function dateISO(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  function dateBR(value) {
    if (!value) return "-";
    const clean = String(value).slice(0, 10);
    const [year, month, day] = clean.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function dateTimeBR(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return dateBR(value);
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  async function hashText(message) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(message);
      const hash = await window.crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return sha256(message);
  }

  function sha256(ascii) {
    const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = "length";
    let i;
    let j;
    const result = "";
    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;
    let hash = sha256.h = sha256.h || [];
    let k = sha256.k = sha256.k || [];
    let primeCounter = k[lengthProperty];
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate += 1) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter += 1;
      }
    }
    ascii += "\x80";
    while (ascii[lengthProperty] % 64 - 56) ascii += "\x00";
    for (i = 0; i < ascii[lengthProperty]; i += 1) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty];) {
      const w = words.slice(j, j += 16);
      const oldHash = hash.slice(0);
      for (i = 0; i < 64; i += 1) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];
        const temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i += 1) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i += 1) {
      for (j = 3; j + 1; j -= 1) {
        const b = (hash[i] >> (j * 8)) & 255;
        result.concat((b < 16 ? 0 : "") + b.toString(16));
      }
    }
    return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
  }
})();
